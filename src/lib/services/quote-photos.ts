import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createQuotePhoto,
  deleteQuotePhoto,
  getQuotePhoto,
  listQuotePhotos,
} from "@/lib/repositories/quote-ai-repository";
import { getQuoteForEdit } from "@/lib/repositories/quote-repository";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
const quotePhotoBucket = "quote-photos";
const maximumPhotoBytes = 6 * 1024 * 1024;
const maximumPhotoCount = 12;
const supportedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type QuotePhotoUpload = {
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export function validateQuotePhotoUpload(businessId: number, quoteId: number, upload: QuotePhotoUpload) {
  if (!upload.storagePath.startsWith(`${businessId}/${quoteId}/`)) throw new Error("The uploaded photo path is invalid.");
  if (!supportedPhotoTypes.has(upload.mimeType)) throw new Error("Photos must be JPEG, PNG, or WebP files.");
  if (!Number.isInteger(upload.sizeBytes) || upload.sizeBytes <= 0 || upload.sizeBytes > maximumPhotoBytes) {
    throw new Error("Each photo must be 6 MB or smaller.");
  }
  const originalName = upload.originalName.trim().slice(0, 240);
  if (!originalName) throw new Error("The photo file name is missing.");
  return { ...upload, originalName };
}

export async function registerQuotePhoto(
  client: Client,
  businessId: number,
  quoteId: number,
  userId: string,
  upload: QuotePhotoUpload,
) {
  const quote = await getQuoteForEdit(client, businessId, quoteId);
  if (!quote) throw new Error("That quote no longer exists.");
  if (quote.status !== "draft") throw new Error("Photos can only be added while the quote is a draft.");
  const validated = validateQuotePhotoUpload(businessId, quoteId, upload);
  const photos = await listQuotePhotos(client, businessId, quoteId);
  if (photos.length >= maximumPhotoCount) throw new Error(`A quote can have up to ${maximumPhotoCount} photos.`);
  return createQuotePhoto(client, {
    business_id: businessId,
    quote_id: quoteId,
    storage_path: validated.storagePath,
    original_name: validated.originalName,
    mime_type: validated.mimeType,
    size_bytes: validated.sizeBytes,
    uploaded_by: userId,
  });
}

export async function removeQuotePhoto(client: Client, businessId: number, quoteId: number, photoId: number) {
  const photo = await getQuotePhoto(client, businessId, quoteId, photoId);
  if (!photo) return false;
  const quote = await getQuoteForEdit(client, businessId, quoteId);
  if (!quote || quote.status !== "draft") throw new Error("Photos can only be removed while the quote is a draft.");
  const storageResult = await client.storage.from(quotePhotoBucket).remove([photo.storage_path]);
  if (storageResult.error) throw new Error(`Unable to remove quote photo: ${storageResult.error.message}`);
  return Boolean(await deleteQuotePhoto(client, businessId, quoteId, photoId));
}

export async function getQuotePhotosWithUrls(client: Client, businessId: number, quoteId: number, expiresInSeconds = 900) {
  const photos = await listQuotePhotos(client, businessId, quoteId);
  return Promise.all(photos.map(async (photo) => {
    const result = await client.storage.from(quotePhotoBucket).createSignedUrl(photo.storage_path, expiresInSeconds);
    if (result.error) throw new Error(`Unable to open quote photo: ${result.error.message}`);
    return { ...photo, signedUrl: result.data.signedUrl };
  }));
}

export const quotePhotoUploadRules = {
  bucket: quotePhotoBucket,
  maximumBytes: maximumPhotoBytes,
  maximumCount: maximumPhotoCount,
  supportedTypes: [...supportedPhotoTypes],
};
