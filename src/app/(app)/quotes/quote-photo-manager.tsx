"use client";

import Image from "next/image";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerUploadedQuotePhoto, removeUploadedQuotePhoto } from "./quote-workbench-actions";

type Photo = {
  id: number;
  original_name: string;
  size_bytes: number;
  signedUrl: string;
};

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maximumBytes = 6 * 1024 * 1024;
const maximumSourceBytes = 25 * 1024 * 1024;
const maximumCount = 12;

type DecodedPhoto = {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

function looksLikeHeic(file: File) {
  return file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name);
}

async function decodeInBrowser(blob: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some mobile browsers expose createImageBitmap but cannot decode every supported format.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The source image cannot be decoded."));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function decodeSourcePhoto(file: File) {
  try {
    return await decodeInBrowser(file);
  } catch (nativeError) {
    if (!looksLikeHeic(file)) throw nativeError;
    try {
      const { heicTo } = await import("heic-to/csp");
      const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
      return await decodeInBrowser(jpeg);
    } catch {
      throw new Error(`${file.name} could not be converted from HEIC. Try sharing or exporting it as a JPEG.`);
    }
  }
}

async function normalizedJpeg(file: File) {
  if (!supportedTypes.has(file.type) && !looksLikeHeic(file)) throw new Error(`${file.name} must be a JPEG, PNG, WebP, or HEIC photo.`);
  if (file.size > maximumSourceBytes) throw new Error(`${file.name} must be 25 MB or smaller before preparation.`);
  const decoded = await decodeSourcePhoto(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob) throw new Error("This browser could not prepare the photo.");
    if (blob.size > maximumBytes) throw new Error(`${file.name} is still larger than 6 MB after preparation.`);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "quote-photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    decoded.close();
  }
}

export function QuotePhotoManager({ businessId, draft, photos, quoteId }: { businessId: number; draft: boolean; photos: Photo[]; quoteId: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger">("success");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > maximumCount) {
      setTone("danger"); setMessage(`A quote can have up to ${maximumCount} photos.`); return;
    }
    setBusy(true); setMessage(null);
    const supabase = createClient();
    let uploaded = 0;
    try {
      for (const source of Array.from(files)) {
        const file = await normalizedJpeg(source);
        const storagePath = `${businessId}/${quoteId}/${crypto.randomUUID()}.jpg`;
        const storage = await supabase.storage.from("quote-photos").upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (storage.error) throw new Error(`Unable to upload ${source.name}: ${storage.error.message}`);
        const registered = await registerUploadedQuotePhoto(quoteId, {
          storagePath,
          originalName: source.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!registered.ok) {
          await supabase.storage.from("quote-photos").remove([storagePath]);
          throw new Error(registered.message || `Unable to register ${source.name}.`);
        }
        uploaded += 1;
      }
      setTone("success"); setMessage(`${uploaded} photo${uploaded === 1 ? "" : "s"} added.`);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setTone("danger"); setMessage(error instanceof Error ? error.message : "The photos could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: number) {
    setBusy(true); setMessage(null);
    const result = await removeUploadedQuotePhoto(quoteId, photoId);
    setTone(result.ok ? "success" : "danger"); setMessage(result.message || null);
    setBusy(false);
    if (result.ok) router.refresh();
  }

  return <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold">Site photos</h2><p className="mt-1 text-sm text-muted">Add clear wide, close, access, and scale-reference photos.</p></div>
      <span className="text-sm font-semibold text-muted">{photos.length}/{maximumCount}</span>
    </div>
    {photos.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo) => <div className="group relative aspect-square overflow-hidden rounded-md border border-line bg-surface-muted" key={photo.id}>
        <a href={photo.signedUrl} rel="noreferrer" target="_blank"><Image alt={photo.original_name} className="object-cover" fill sizes="(max-width: 640px) 45vw, 220px" src={photo.signedUrl} /></a>
        {draft ? <button aria-label={`Remove ${photo.original_name}`} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-md bg-surface text-danger shadow disabled:opacity-60" disabled={busy} onClick={() => remove(photo.id)} title="Remove photo" type="button"><Trash2 size={16} /></button> : null}
      </div>)}
    </div> : <div className="mt-4 flex min-h-28 items-center justify-center rounded-md border border-dashed border-line-strong bg-page px-4 text-center text-sm text-muted">No site photos attached yet.</div>}
    {draft ? <div className="mt-4">
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-line-strong px-4 font-semibold">
        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <ImagePlus size={17} />}{busy ? "Preparing photos..." : "Add photos"}
        <input ref={inputRef} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" disabled={busy || photos.length >= maximumCount} multiple onChange={(event) => upload(event.target.files)} type="file" />
      </label>
      <p className="mt-2 text-xs leading-5 text-muted">JPEG, PNG, WebP, HEIC, or HEIF. Each photo is converted to JPEG, resized, and stripped of embedded metadata before upload.</p>
    </div> : null}
    {message ? <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${tone === "success" ? "border-brand-border bg-brand-soft text-brand" : "border-danger-line bg-danger-soft text-danger"}`}>{message}</p> : null}
  </section>;
}
