import { mail } from "../src/framework/support/mail.js";

const targetEmail = process.argv[2] || "vatmatebd@gmail.com";

console.log(`Sending test email to: ${targetEmail}...`);

try {
  const result = await mail.sendMail({
    to: targetEmail,
    subject: "IDP SMTP Test Mail",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">cPanel SMTP Test Successful! 🎉</h2>
        <p>আপনার cPanel SMTP কনফিগারেশন সফলভাবে কাজ করছে।</p>
        <p><strong>App:</strong> IDP-V2</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
    `
  });

  console.log("✅ Test email sent successfully!", result);
} catch (error) {
  console.error("❌ Failed to send email:", error);
}
