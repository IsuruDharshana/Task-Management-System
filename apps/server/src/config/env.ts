import dotenv from "dotenv";

dotenv.config();

const requiredEnvVariables = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "JWT_SECRET",
] as const;

for (const envName of requiredEnvVariables) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

export const env = {
  port: process.env.PORT || "5000",
  clientUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173",

  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET as string,

  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.MAIL_FROM || process.env.EMAIL_FROM || "",
};
