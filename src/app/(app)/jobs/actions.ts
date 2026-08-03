"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { isSupportedJobStatus } from "@/lib/domain/jobs";
import { createJob, getJobForEdit, updateJob } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { jobFormSchema, jobValuesFromFormData } from "@/lib/validation/operations";

export type JobFormState = {
  message?: string;
  errors?: Record<string, string[]>;
};

export async function saveJob(
  jobId: number | null,
  _: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const validated = jobFormSchema.safeParse(jobValuesFromFormData(formData));
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors };

  const { business } = await requireBusinessContext();
  const client = await createClient();
  const existing = jobId === null ? null : await getJobForEdit(client, business.id, jobId);
  if (jobId !== null && !existing) return { message: "That job no longer exists." };

  const statusIsUnchangedImportedValue = existing && validated.data.status === existing.status;
  if (!isSupportedJobStatus(validated.data.status) && !statusIsUnchangedImportedValue) {
    return { errors: { status: ["Select a supported job status."] } };
  }

  const values = {
    business_id: business.id,
    customer_id: validated.data.customerId,
    status: validated.data.status,
    job_date: validated.data.jobDate ?? null,
    scheduled_date: validated.data.scheduledDate ?? null,
    scheduled_start_time: validated.data.scheduledStartTime ?? null,
    estimated_duration_minutes: validated.data.estimatedDurationMinutes ?? null,
    completed_date: validated.data.completedDate ?? null,
    service_address: validated.data.serviceAddress ?? null,
    municipality: validated.data.municipality ?? null,
    property_location: validated.data.propertyLocation ?? null,
    location_description: validated.data.locationDescription ?? null,
    referral_source: validated.data.referralSource ?? null,
    work_description: validated.data.workDescription ?? null,
    hazard_notes: validated.data.hazardNotes ?? null,
    amount_quoted: validated.data.amountQuoted ?? null,
    amount_paid: validated.data.amountPaid ?? null,
    payment_method: validated.data.paymentMethod ?? null,
    paid_date: validated.data.paidDate ?? null,
    travel_minutes: validated.data.travelMinutes ?? null,
    grinding_minutes: validated.data.grindingMinutes ?? null,
    cleanup_minutes: validated.data.cleanupMinutes ?? null,
    machine_hours: validated.data.machineHours ?? null,
    pro_bono: validated.data.proBono,
    pa811_required: validated.data.pa811Required,
    notes: validated.data.notes ?? null,
  };

  try {
    if (jobId === null) {
      const created = await createJob(client, values);
      revalidatePath("/jobs");
      revalidatePath("/dashboard");
      redirect(`/jobs/${created.id}`);
    }

    const updated = await updateJob(client, business.id, jobId, values);
    if (!updated) return { message: "That job no longer exists." };
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/customers/${validated.data.customerId}`);
    revalidatePath("/dashboard");
    redirect(`/jobs/${jobId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: "The job could not be saved. Check the values and try again." };
  }
}
