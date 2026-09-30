import { env } from "@/env.js";

/**
 * Why: SMTP mail transport settings.
 * When: Transactional mail (signup, reset, verify) is sent.
 * Where: src/config/mail.ts.
 * How: Host, ports, encryption, from address and fail-silent are plain
 *      literals. Username/password are credentials and stay in .env.
 */
export const mailConfig = {
  host: env.MAIL_HOST || "127.0.0.1",
  port: env.MAIL_PORT || 1089,
  encryption: env.MAIL_ENCRYPTION || "none",
  username: env.MAIL_USERNAME || undefined,
  password: env.MAIL_PASSWORD || undefined,
  fromAddress: env.MAIL_FROM_ADDRESS
    ? (env.MAIL_FROM_NAME ? `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>` : env.MAIL_FROM_ADDRESS)
    : "no-reply@example.com",
  failSilent: env.APP_ENV === "production",
  maildev: {
    smtpPort: 1089,
    webPort: 1080
  }
};

export type MailConfig = typeof mailConfig;
