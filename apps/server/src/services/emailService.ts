import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../email/templates/baseEmailTemplate.js";
import { buildWelcomeEmailHtml, buildWelcomeEmailText } from "../email/templates/welcomeEmailTemplate.js";
import { sendWithResend } from "./email/resendProvider.js";

interface TemporaryPasswordEmailInput {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
}

interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getWelcomeLogoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "apps/server/src/email/assets/Logo_transparent.png"),
    path.resolve(process.cwd(), "src/email/assets/Logo_transparent.png"),
    path.resolve(__dirname, "../email/assets/Logo_transparent.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getEmailLogoSource(): { logoSrc: string | null } {
  const emailLogoUrl = process.env.EMAIL_LOGO_URL?.trim();

  if (emailLogoUrl) {
    return { logoSrc: emailLogoUrl };
  }

  // Resend sends are not attached to local files, so we can only use a
  // logo here if it's hosted at a public URL (EMAIL_LOGO_URL).
  const logoPath = getWelcomeLogoPath();
  if (logoPath) {
    console.warn("EMAIL_LOGO_URL is not set, so the Veyra logo will be omitted from onboarding emails.");
  }

  return { logoSrc: null };
}

function buildOnboardingEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): EmailContent {
  const subject = "Welcome to Veyra";
  const logo = getEmailLogoSource();

  return {
    subject,
    text: buildWelcomeEmailText({
      name,
      email: to,
      temporaryPassword,
      loginUrl,
      logoSrc: logo.logoSrc,
    }),
    html: buildWelcomeEmailHtml({
      name,
      email: to,
      temporaryPassword,
      loginUrl,
      logoSrc: logo.logoSrc,
    }),
  };
}

function buildPasswordResetEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): EmailContent {
  const subject = "Your Veyra password has been reset";

  return {
    subject,
    text: `Hello ${name},

An administrator has reset your Veyra password.

Name: ${name}
Login email / username: ${to}
New temporary password: ${temporaryPassword}

Login URL: ${loginUrl}

You must reset your password after logging in.`,
    html: `
      <p>Hello ${escapeHtml(name)},</p>
      <p>An administrator has reset your Veyra password.</p>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(name)}</li>
        <li><strong>Login email / username:</strong> ${escapeHtml(to)}</li>
        <li><strong>New temporary password:</strong> ${escapeHtml(temporaryPassword)}</li>
      </ul>
      <p><a href="${escapeHtml(loginUrl)}">Log in to Veyra</a></p>
      <p><strong>You must reset your password after logging in.</strong></p>
    `,
  };
}

async function sendEmailOrPrintFallback(
  input: TemporaryPasswordEmailInput,
  content: EmailContent,
  fallbackTitle: string
): Promise<void> {
  const hasResendConfig = Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM || process.env.MAIL_FROM);

  if (!hasResendConfig) {
    console.log(`
========================================
[EMAIL] VEYRA DEV EMAIL - ${fallbackTitle}
========================================

To: ${input.to}
Subject: ${content.subject}

Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM to send this message.
Login URL: ${input.loginUrl}
Temporary password omitted from logs.

========================================
`);
    return;
  }

  await sendWithResend({
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  console.info(`Sent Veyra email "${content.subject}" to ${input.to}.`);
}

export async function sendUserOnboardingEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): Promise<void> {
  const input = { to, name, temporaryPassword, loginUrl };
  await sendEmailOrPrintFallback(input, buildOnboardingEmail(input), "USER ONBOARDING");
}

export async function sendPasswordResetEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): Promise<void> {
  const input = { to, name, temporaryPassword, loginUrl };
  await sendEmailOrPrintFallback(input, buildPasswordResetEmail(input), "PASSWORD RESET");
}