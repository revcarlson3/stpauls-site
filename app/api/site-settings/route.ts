import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptConfig, getMailSettings, getRegistrationCode } from "@/lib/app-config";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth";
import { normalizeModuleSlugs } from "@/lib/modules";

export async function GET() {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const [mail, code, current] = await Promise.all([getMailSettings(), getRegistrationCode(), db.securitySettings.findUnique({ where: { id: 1 }, select: { enabledModules: true } })]);
    const enabledModules = Array.isArray(current?.enabledModules) ? current.enabledModules : [];
    return NextResponse.json({ smtpHost: mail.smtpHost, smtpPort: mail.smtpPort, smtpUser: mail.smtpUser, emailFrom: mail.emailFrom, registrationCodeConfigured: Boolean(code), smtpPasswordConfigured: Boolean(mail.smtpPassword), enabledModules });
  } catch {
    return NextResponse.json({ error: "Unable to load site settings." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  const enabledModules = input?.enabledModules === undefined ? undefined : normalizeModuleSlugs(input.enabledModules);
  if (!input || typeof input.smtpHost !== "string" || !Number.isInteger(input.smtpPort) || input.smtpPort < 1 || input.smtpPort > 65535 || typeof input.smtpUser !== "string" || typeof input.emailFrom !== "string" || typeof input.registrationCode !== "string" || (input.smtpPassword !== undefined && typeof input.smtpPassword !== "string") || (input.enabledModules !== undefined && !enabledModules)) {
    return NextResponse.json({ error: "Invalid site settings." }, { status: 400 });
  }
  try {
    const settingsUser = await requirePermission("MANAGE_SETTINGS");
    if (enabledModules !== undefined && !(await hasPermission(settingsUser.id, "MANAGE_MODULES"))) {
      return NextResponse.json({ error: "Manage Modules permission is required." }, { status: 403 });
    }
    const current = await db.securitySettings.findUnique({ where: { id: 1 }, select: { smtpPasswordEncrypted: true, registrationCodeEncrypted: true } });
    return NextResponse.json(await db.securitySettings.upsert({
      where: { id: 1 },
      update: {
        smtpHost: input.smtpHost.trim(), smtpPort: input.smtpPort, smtpUser: input.smtpUser.trim(), emailFrom: input.emailFrom.trim(),
        smtpPasswordEncrypted: input.smtpPassword ? encryptConfig(input.smtpPassword) : current?.smtpPasswordEncrypted ?? null,
        registrationCodeEncrypted: input.registrationCode ? encryptConfig(input.registrationCode) : current?.registrationCodeEncrypted ?? null,
        ...(enabledModules === undefined || enabledModules === null ? {} : { enabledModules })
      },
      create: { id: 1, smtpHost: input.smtpHost.trim(), smtpPort: input.smtpPort, smtpUser: input.smtpUser.trim(), emailFrom: input.emailFrom.trim(), smtpPasswordEncrypted: input.smtpPassword ? encryptConfig(input.smtpPassword) : null, registrationCodeEncrypted: input.registrationCode ? encryptConfig(input.registrationCode) : null, enabledModules: enabledModules ?? [] }
    }).then(() => ({ saved: true })));
  } catch {
    return NextResponse.json({ error: "Unable to save site settings." }, { status: 500 });
  }
}
