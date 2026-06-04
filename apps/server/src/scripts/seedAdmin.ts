import "dotenv/config";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../config/supabaseAdmin";

type UserRole = "admin" | "project_manager" | "collaborator";

const ADMIN_ROLE: UserRole = "admin";
const BCRYPT_SALT_ROUNDS = 12;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function validateEmail(email: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error("SEED_ADMIN_EMAIL must be a valid email address");
  }
}

function validatePassword(password: string): void {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if (
    !hasMinimumLength ||
    !hasUppercase ||
    !hasLowercase ||
    !hasNumber ||
    !hasSpecialCharacter
  ) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be at least 8 characters and include uppercase, lowercase, number, and special character"
    );
  }
}

async function seedAdmin(): Promise<void> {
  const name = getRequiredEnv("SEED_ADMIN_NAME");
  const email = getRequiredEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("SEED_ADMIN_PASSWORD");

  validateEmail(email);
  validatePassword(password);

  const { data: existingAdmin, error: existingAdminError } = await supabaseAdmin
    .from("app_users")
    .select("id, email, role")
    .eq("role", ADMIN_ROLE)
    .limit(1)
    .maybeSingle();

  if (existingAdminError) {
    throw new Error(`Failed to check existing Admin: ${existingAdminError.message}`);
  }

  if (existingAdmin) {
    console.log("Admin seed skipped.");
    console.log(`An Admin user already exists: ${existingAdmin.email}`);
    return;
  }

  const { data: existingUserWithEmail, error: existingUserError } = await supabaseAdmin
    .from("app_users")
    .select("id, email, role")
    .eq("email", email)
    .maybeSingle();

  if (existingUserError) {
    throw new Error(`Failed to check existing user email: ${existingUserError.message}`);
  }

  if (existingUserWithEmail) {
    throw new Error(
      `A user with email ${email} already exists with role ${existingUserWithEmail.role}. Admin seed aborted.`
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const { data: createdAdmin, error: createAdminError } = await supabaseAdmin
    .from("app_users")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: ADMIN_ROLE,
      is_active: true,
      must_reset_password: true,
    })
    .select("id, name, email, role, must_reset_password")
    .single();

  if (createAdminError) {
    throw new Error(`Failed to create Admin user: ${createAdminError.message}`);
  }

  console.log("First Admin user created successfully.");
  console.log({
    id: createdAdmin.id,
    name: createdAdmin.name,
    email: createdAdmin.email,
    role: createdAdmin.role,
    must_reset_password: createdAdmin.must_reset_password,
  });
}

seedAdmin()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error("Admin seed failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });