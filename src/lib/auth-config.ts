export const initialOwnerEmail = "jeffdemi@gmail.com";

export function isInitialOwnerEmail(email: string) {
  return email.trim().toLowerCase() === initialOwnerEmail;
}
