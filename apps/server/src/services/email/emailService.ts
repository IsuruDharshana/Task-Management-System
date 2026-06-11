import { sendWithNodemailer } from "./nodemailerEmailProvider.js";

type WelcomeEmailInput = {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl?: string;
};

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const provider = process.env.MAIL_PROVIDER ?? "nodemailer";

  const subject = "Welcome to Veyra Task Management System";

  const loginUrl = input.loginUrl ?? "http://localhost:5173/login";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to Veyra Task Management System</h2>

      <p>Hello ${input.name},</p>

      <p>Your Veyra account has been created.</p>

      <p><strong>Email:</strong> ${input.to}</p>
      <p><strong>Temporary Password:</strong> ${input.temporaryPassword}</p>

      <p>
        Please log in using the temporary password above. 
        You will be required to reset your password before using the system.
      </p>

      <p>
        Login here: <a href="${loginUrl}">${loginUrl}</a>
      </p>

      <p>Thank you,<br/>Veyra TMS</p>
    </div>
  `;

  if (provider === "nodemailer") {
    return sendWithNodemailer({
      to: input.to,
      subject,
      html,
    });
  }

  throw new Error(`Unsupported mail provider: ${provider}`);
}