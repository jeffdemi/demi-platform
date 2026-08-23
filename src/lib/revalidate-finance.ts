import { revalidatePath } from "next/cache";

export function refreshFinance() {
  revalidatePath("/finance");
  revalidatePath("/transactions");
  revalidatePath("/expenses");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
