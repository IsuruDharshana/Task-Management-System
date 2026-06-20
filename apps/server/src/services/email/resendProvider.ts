import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY environment variable. Set it in your .env file (locally) or in Render's Environment tab (deployed)."
    );
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export async function sendWithResend(input: SendEmailInput) {
  const from = process.env.EMAIL_FROM || process.env.MAIL_FROM;

  if (!from) {
    throw new Error(
      "Missing EMAIL_FROM environment variable. Set it to a verified sender address, e.g. 'Veyra <onboarding@resend.dev>' for testing."
    );
  }

  const client = getResendClient();

  const { data, error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }

  return data;
}