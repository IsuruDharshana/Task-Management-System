interface TemporaryPasswordEmailInput {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
}

export async function sendUserOnboardingEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): Promise<void> {
  console.log(`
========================================
[EMAIL] VEYRA DEV EMAIL - USER ONBOARDING
========================================

To: ${to}
Subject: Welcome to Veyra

Hello ${name},

Your Veyra account has been created.

Login email: ${to}
Temporary password: ${temporaryPassword}

Login URL: ${loginUrl}

You must reset your password after your first login.

========================================
`);
}

export async function sendPasswordResetEmail({
  to,
  name,
  temporaryPassword,
  loginUrl,
}: TemporaryPasswordEmailInput): Promise<void> {
  console.log(`
========================================
[EMAIL] VEYRA DEV EMAIL - PASSWORD RESET
========================================

To: ${to}
Subject: Your Veyra password has been reset

Hello ${name},

An administrator has reset your Veyra password.

Login email: ${to}
Temporary password: ${temporaryPassword}

Login URL: ${loginUrl}

You must reset your password after logging in.

========================================
`);
}
