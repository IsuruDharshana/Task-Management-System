import nodemailer from "nodemailer";

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

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

let transporter: nodemailer.Transporter | null = null;

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.MAIL_FROM?.trim() || process.env.EMAIL_FROM?.trim();

  if (!host || !portValue || !user || !pass || !from) {
    return null;
  }

  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer.");
  }

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    user,
    pass,
    from,
  };
}

function getTransporter(config: SmtpConfig): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOnboardingEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): EmailContent {
  const subject = "Welcome to Veyra";

  return {
    subject,
    text: `Hello ${name},

Your Veyra account has been created.

Name: ${name}
Login email / username: ${to}
Temporary password: ${temporaryPassword}

Login URL: ${loginUrl}

You must reset your password after your first login.`,
    html: `
      <p>Hello ${escapeHtml(name)},</p>
      <p>Your Veyra account has been created.</p>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(name)}</li>
        <li><strong>Login email / username:</strong> ${escapeHtml(to)}</li>
        <li><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</li>
      </ul>
      <p><a href="${escapeHtml(loginUrl)}">Log in to Veyra</a></p>
      <p><strong>You must reset your password after your first login.</strong></p>
    `,
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
  const smtpConfig = getSmtpConfig();

  if (!smtpConfig) {
    console.log(`
========================================
[EMAIL] VEYRA DEV EMAIL - ${fallbackTitle}
========================================

To: ${input.to}
Subject: ${content.subject}

${content.text}

========================================
`);
    return;
  }

  await getTransporter(smtpConfig).sendMail({
    from: smtpConfig.from,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
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
