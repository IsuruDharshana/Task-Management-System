export interface BaseEmailTemplateInput {
  previewText: string;
  logoHtml: string;
  bodyHtml: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBaseEmailTemplate({
  previewText,
  logoHtml,
  bodyHtml,
}: BaseEmailTemplateInput): string {
  const safePreview = escapeHtml(previewText);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>Veyra</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-wrapper { padding: 12px !important; }
        .email-container { width: 100% !important; }
        .email-card { border-radius: 0 !important; }
        .email-padding { padding: 24px !important; }
        .email-hero { padding: 30px 24px !important; }
        .email-title { font-size: 26px !important; line-height: 1.16 !important; }
        .email-button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
        .credential-label, .credential-value { display: block !important; width: 100% !important; text-align: left !important; }
        .credential-value { padding-top: 6px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#F6F8FC; color:#0F172A; font-family:Inter, Manrope, Avenir Next, Segoe UI, Arial, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${safePreview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-wrapper" style="width:100%; background:#F6F8FC; padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-container" style="width:100%; max-width:600px;">
            <tr>
              <td class="email-card" style="background:#FFFFFF; border:1px solid #D8E2F0; border-radius:20px; overflow:hidden; box-shadow:0 20px 45px rgba(15, 49, 145, 0.10);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-padding" style="padding:24px 32px; background:#FFFFFF;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="left">${logoHtml}</td>
                          <td align="right" style="font-size:12px; line-height:1.4; color:#64748B; font-weight:600;">Task Management System</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${bodyHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 18px 0; color:#64748B; font-size:12px; line-height:1.6;">
                <strong style="color:#0E3191;">Veyra</strong><br>
                &copy; 2026 Veyra. All rights reserved.<br>
                This is an automated message from Veyra Task Management System.<br>
                If you were not expecting this email, please contact your administrator.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
