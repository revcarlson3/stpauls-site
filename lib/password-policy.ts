import { db } from "@/lib/db";

export const defaultPasswordPolicy = { minPasswordLength: 12, passwordRequireUppercase: true, passwordRequireLowercase: true, passwordRequireNumber: true, passwordRequireSymbol: true, passwordExcludeAmbiguous: true };

export async function getPasswordPolicy() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { minPasswordLength: true, passwordRequireUppercase: true, passwordRequireLowercase: true, passwordRequireNumber: true, passwordRequireSymbol: true, passwordExcludeAmbiguous: true } });
  return settings ?? defaultPasswordPolicy;
}

export async function validatePassword(password: string) {
  const policy = await getPasswordPolicy();
  if (password.length < policy.minPasswordLength) return `Password must be at least ${policy.minPasswordLength} characters.`;
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) return "Password must include a number.";
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";
  if (policy.passwordExcludeAmbiguous && /[0OIl1|]/.test(password)) return "Password cannot include ambiguous characters such as 0, O, I, l, or 1.";
  return null;
}
