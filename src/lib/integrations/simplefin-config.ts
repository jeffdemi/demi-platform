import { z } from "zod";

export const SIMPLEFIN_CREATE_URL = "https://bridge.simplefin.org/simplefin/create";

export function getSimpleFinConfiguration() {
  return z.object({
    encryptionKey: z.string().min(1, "BANK_CONNECTION_ENCRYPTION_KEY is not configured."),
  }).parse({
    encryptionKey: process.env.BANK_CONNECTION_ENCRYPTION_KEY,
  });
}
