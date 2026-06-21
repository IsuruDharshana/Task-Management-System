import { env } from "../../config/env.js";
import { buildWelcomeEmailHtml, buildWelcomeEmailText } from "../../email/templates/welcomeEmailTemplate.js";
import { sendWithResend } from "./resendProvider.js";

type WelcomeEmailInput = {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
};

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const subject = "Welcome to Veyra Task Management System";

  const loginUrl = input.loginUrl ?? `${env.clientUrl}/login`;
  const templateInput = {
    name: input.name,
    email: input.to,
    temporaryPassword: input.temporaryPassword,
    loginUrl,
    logoSrc: process.env.EMAIL_LOGO_URL?.trim() || null,
  };

  return sendWithResend({
    to: input.to,
    subject,
    html: buildWelcomeEmailHtml(templateInput),
    text: buildWelcomeEmailText(templateInput),
  });
}
