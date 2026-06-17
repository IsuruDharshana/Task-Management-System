import { buildBaseEmailTemplate, escapeHtml } from "./baseEmailTemplate.js";

export interface WelcomeEmailTemplateInput {
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  logoSrc: string | null;
}

function buildLogoHtml(logoSrc: string | null): string {
  if (!logoSrc) {
    return `<span style="display:inline-block; color:#0E3191; font-size:24px; line-height:1; font-weight:800; letter-spacing:0;">Veyra</span>`;
  }

  return `<img src="${escapeHtml(logoSrc)}" width="116" alt="Veyra" style="display:block; width:116px; max-width:116px; height:auto; border:0; outline:none; text-decoration:none;">`;
}

function buildCredentialRow(label: string, valueHtml: string): string {
  return `<tr>
    <td class="credential-label" style="padding:12px 0; color:#64748B; font-size:11px; line-height:1.3; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #D8E2F0;">${escapeHtml(label)}</td>
    <td class="credential-value" align="right" style="padding:12px 0; color:#0F172A; font-size:14px; line-height:1.45; font-weight:650; border-bottom:1px solid #D8E2F0;">${valueHtml}</td>
  </tr>`;
}

export function buildWelcomeEmailHtml({
  name,
  email,
  temporaryPassword,
  loginUrl,
  logoSrc,
}: WelcomeEmailTemplateInput): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);

  const bodyHtml = `
    <tr>
      <td class="email-hero" style="padding:38px 32px; background:#0E3191; background-image:radial-gradient(circle at 18% 20%, rgba(201,224,252,0.28) 0 2px, transparent 3px), linear-gradient(135deg, #0E3191 0%, #296EF9 100%);">
        <h1 class="email-title" style="margin:0; color:#FFFFFF; font-size:32px; line-height:1.12; font-weight:750;">Welcome to Veyra</h1>
        <p style="margin:12px 0 0; color:#EAF2FF; font-size:16px; line-height:1.6; font-weight:400;">Your workspace account is ready.</p>
      </td>
    </tr>
    <tr>
      <td class="email-padding" style="padding:32px; background:#FFFFFF;">
        <p style="margin:0 0 16px; color:#0F172A; font-size:16px; line-height:1.6;">Hello ${safeName},</p>
        <p style="margin:0 0 24px; color:#475569; font-size:15px; line-height:1.65;">An administrator has created your Veyra account. Use the credentials below to sign in for the first time.</p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F1F7FF; border:1px solid #C9E0FC; border-radius:16px; padding:4px 18px; margin:0 0 26px;">
          ${buildCredentialRow("Name", safeName)}
          ${buildCredentialRow("Login email", safeEmail)}
          <tr>
            <td class="credential-label" style="padding:12px 0; color:#64748B; font-size:11px; line-height:1.3; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">Temporary password</td>
            <td class="credential-value" align="right" style="padding:12px 0; color:#0F172A; font-size:14px; line-height:1.45; font-weight:650;">
              <span style="display:inline-block; padding:8px 10px; border-radius:10px; background:#FFFFFF; border:1px solid #C9E0FC; color:#0E3191; font-family:Consolas, Monaco, Courier New, monospace; font-size:14px; letter-spacing:0.02em;">${safePassword}</span>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
          <tr>
            <td align="center">
              <a href="${safeLoginUrl}" class="email-button" style="display:inline-block; background:#296EF9; color:#FFFFFF; text-decoration:none; border-radius:999px; padding:14px 24px; font-size:15px; line-height:1.2; font-weight:700;">Sign in to Veyra</a>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F6F8FC; border:1px solid #D8E2F0; border-radius:14px;">
          <tr>
            <td style="padding:16px 18px; color:#64748B; font-size:13px; line-height:1.6;">
              <strong style="color:#0E3191;">Security note:</strong>
              For your security, you will be asked to create a new password after your first login. Do not share your temporary password with anyone.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return buildBaseEmailTemplate({
    previewText: "Your Veyra workspace account is ready.",
    logoHtml: buildLogoHtml(logoSrc),
    bodyHtml,
  });
}

export function buildWelcomeEmailText({
  name,
  email,
  temporaryPassword,
  loginUrl,
}: WelcomeEmailTemplateInput): string {
  return `Hello ${name},

An administrator has created your Veyra account. Use the credentials below to sign in for the first time.

Name: ${name}
Login email: ${email}
Temporary password: ${temporaryPassword}

Sign in to Veyra: ${loginUrl}

For your security, you will be asked to create a new password after your first login. Do not share your temporary password with anyone.`;
}
