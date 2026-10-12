import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  referral: z.string().trim().max(200).optional().nullable(),
});

// Public: saves an access request and alerts the owner by email.
export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const referral = data.referral || null;
    const { data: row, error } = await supabaseAdmin
      .from("access_requests")
      .insert({ email: data.email, referral })
      .select("id, created_at")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: true }; // already requested, no repeat alert
      console.error("access request insert failed", error);
      throw new Error("Couldn't submit your request");
    }
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("access-request-alert", "priyanshu@acemail.online", {
        templateData: {
          email: data.email,
          referral,
          submittedAt: new Date(row.created_at).toUTCString(),
        },
        idempotencyKey: `access-request-${row.id}`,
        replyTo: data.email,
      });
    } catch (e) {
      console.error("access request alert failed", e);
    }
    return { ok: true };
  });
