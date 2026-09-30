import { dispatchEvent, mail, shouldQueue } from "@/framework/facade.js";

shouldQueue("user:forget-password", "mail", async (job) => {
  const { email, name, resetUrl } = job.data;

  await mail.sendMail({
    to: email,
    subject: "Reset Your Password - IDP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">পাসওয়ার্ড রিসেট অনুরোধ / Password Reset</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello ${name || "User"},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">
          We received a request to reset your IDP account password. Click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
            Reset Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
          This link will expire in <strong>15 minutes</strong>. If the button above doesn't work, copy and paste this link into your browser:
        </p>
        <p style="word-break: break-all; font-size: 12px; color: #2563eb;">
          <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `
  });

  await dispatchEvent("user.changed", { email: email }, { broadcast: { auth: true } });

  return { ok: true, resetUrl };
});
