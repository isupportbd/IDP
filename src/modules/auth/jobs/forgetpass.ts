import { dispatchEvent, mail, shouldQueue } from "@/framework/facade.js";

shouldQueue("user:forget-password", "mail", async (job) => {
  const { email, name, resetUrl, otp } = job.data;

  const subject = otp ? `${otp} is your IDP verification code` : "Reset Your Password - IDP";

  const textBody = `Hello ${name || "User"},

We received a request to reset your IDP account password.

Your 6-Digit OTP Code is: ${otp || ""}

${resetUrl ? `Or use this password reset link:\n${resetUrl}\n` : ""}
This code is valid for 15 minutes.
If you did not make this request, please ignore this email.

— IDP Security Team`;

  await mail.sendMail({
    to: email,
    subject,
    text: textBody,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
        <!-- Preheader preview text for inbox -->
        <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
          Your IDP password reset verification code is ${otp || ""}.
        </div>

        <div style="max-width: 520px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 0.5px;">IDP Portal</div>
          </div>

          <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 600; text-align: center;">পাসওয়ার্ড রিসেট ভেরিফিকেশন</h2>
          
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 16px 0;">
            Hello <strong>${name || "User"}</strong>,<br>
            We received a request to reset the password for your IDP account. Please use the verification code below:
          </p>

          ${
            otp
              ? `
          <div style="text-align: center; margin: 24px 0;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Verification Code</div>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; background: #eff6ff; padding: 14px 28px; border-radius: 8px; display: inline-block; border: 1px solid #bfdbfe;">
              ${otp}
            </div>
          </div>
          `
              : ""
          }

          ${
            resetUrl
              ? `
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
              Reset Password Directly
            </a>
          </div>
          `
              : ""
          }

          <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; text-align: center;">
            ⏱️ This code will expire in <strong>15 minutes</strong>.
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.4; margin: 0; text-align: center;">
            If you did not request this, you can safely ignore this email.<br>
            © ${new Date().getFullYear()} IDP. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `
  });

  await dispatchEvent("user.changed", { email: email }, { broadcast: { auth: true } });

  return { ok: true, resetUrl, otp };
});
