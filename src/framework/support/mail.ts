import nodemailer from "nodemailer";
import { mailConfig } from "@/config/index.js";
import { logger } from "@/framework/support/logger.js";

type MailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

const isSecure = mailConfig.encryption === "ssl" || Number(mailConfig.port) === 465;

const transport = nodemailer.createTransport({
  host: mailConfig.host,
  port: Number(mailConfig.port),
  secure: isSecure,
  auth: mailConfig.username ? { user: mailConfig.username, pass: mailConfig.password } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

export const mail = {
  /**
   * Why: Sends transactional email through configured SMTP transport.
   * When: Features need notifications/password reset/signup email.
   * Where: Jobs and event handlers.
   * How: Uses nodemailer transport and respects the fail-silent setting.
   */
  async sendMail(payload: MailPayload) {
    try {
      const textFallback =
        payload.text ||
        (payload.html
          ? payload.html
              .replace(/<style[^>]*>.*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : undefined);

      return await transport.sendMail({
        from: mailConfig.fromAddress,
        ...payload,
        text: textFallback,
        headers: {
          "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          "X-Auto-Response-Suppress": "OOF, AutoReply",
          Auto_Submitted: "auto-generated"
        }
      });
    } catch (error) {
      logger.error("Mail send failed", {
        to: payload.to,
        subject: payload.subject,
        error: error instanceof Error ? error.message : error
      });

      if (!mailConfig.failSilent) throw error;
      return null;
    }
  }
};
