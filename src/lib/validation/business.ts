import { z } from "zod";

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter a business name.").max(120),
});
