import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(value: string) {
  const trimmed = value.trim();
  const decoded = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");
  if (decoded.length !== 32) throw new Error("BANK_CONNECTION_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return decoded;
}

export function encryptBankAccessToken(accessToken: string, keyValue: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(keyValue), iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptBankAccessToken(encrypted: string, keyValue: string) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("The stored bank access token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(keyValue), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
