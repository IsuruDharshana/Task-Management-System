import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { AppError } from "./appError.js";

const SALT_ROUNDS = 12;
const TEMPORARY_PASSWORD_LENGTH = 16;
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SPECIAL = "!@#$%^&*";
const PASSWORD_CHARACTERS = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SPECIAL}`;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function validatePasswordPolicy(password: string): void {
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
    throw new AppError(
      400,
      "WEAK_PASSWORD",
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
    );
  }
}

function pickRandomCharacter(characters: string): string {
  return characters[randomInt(characters.length)];
}

export function generateTemporaryPassword(): string {
  const requiredCharacters = [
    pickRandomCharacter(UPPERCASE),
    pickRandomCharacter(LOWERCASE),
    pickRandomCharacter(NUMBERS),
    pickRandomCharacter(SPECIAL),
  ];

  const remainingCharacters = Array.from(
    { length: TEMPORARY_PASSWORD_LENGTH - requiredCharacters.length },
    () => pickRandomCharacter(PASSWORD_CHARACTERS)
  );

  const characters = [...requiredCharacters, ...remainingCharacters];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}
