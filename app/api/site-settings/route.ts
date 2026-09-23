import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptConfig, getMailSettings, getRegistrationCode } from "@/lib/app-config";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth";
import { normalizeModuleSlugs } from "@/lib/modules";
import { isHexColor, isThemeFamily, isThemeStyle, isThemeWidth, THEME_BUTTONS, THEME_ELEVATIONS, THEME_NAVS, THEME_RADII, THEME_SPACING } from "@/lib/theme";

export async function GET() {
  try {
    await requirePermission("MANAGE_SETTINGS");
    const settingsUser = await requirePermission("MANAGE_SETTINGS");
    const [mail, code, current, tenantSettings] = await Promise.all([getMailSettings(), getRegistrationCode(), db.securitySettings.findUnique({ where: { id: 1 }, select: { enabledModules: true, publicSiteEnabled: true, maintenanceMode: true, siteName: true, siteTagline: true, adminSiteName: true, adminSiteTagline: true, pollinationsApiKeyEncrypted: true, membershipMessageRecipientLimit: true, prayerRequestsAdminEmail: true, prayerRequestsSundayEmail: true, prayerRequestsEldersEmail: true, themeFamily: true, themeWidth: true, themeBackground: true, themeForeground: true, themeAccent: true, themeSurface: true, themeButtonPrimary: true, themeButtonSecondary: true, themeButtonDefault: true, themeNotificationPrimary: true, themeNotificationSecondary: true, themeNotificationDefault: true, themeNotificationSuccess: true, themeNotificationWarning: true, themeNotificationDanger: true, themeNotificationInfo: true, themeHeadingFont: true, themeBodyFont: true, themeRadius: true, themeElevation: true, themeButton: true, themeNav: true, themeSpacing: true, themeContentBorder: true } }), settingsUser.churchId ? db.church.findUnique({ where: { id: settingsUser.churchId }, select: { publicSiteEnabled: true, maintenanceMode: true } }) : Promise.resolve(null)]);
    const enabledModules = Array.isArray(current?.enabledModules) ? current.enabledModules : [];
    const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { emailProvider: true, emailApiDomain: true, emailApiRegion: true, emailApiKeyEncrypted: true, emailApiSecretEncrypted: true, smsProvider: true, smsAccountId: true, smsAuthSecretEncrypted: true, smsFrom: true } });
    return NextResponse.json({ smtpHost: mail.smtpHost, smtpPort: mail.smtpPort, smtpUser: mail.smtpUser, emailFrom: mail.emailFrom, emailProvider: settings?.emailProvider ?? "smtp", emailApiDomain: settings?.emailApiDomain ?? "", emailApiRegion: settings?.emailApiRegion ?? "", emailApiKeyConfigured: Boolean(settings?.emailApiKeyEncrypted), emailApiSecretConfigured: Boolean(settings?.emailApiSecretEncrypted), smsProvider: settings?.smsProvider ?? "twilio", smsAccountId: settings?.smsAccountId ?? "", smsFrom: settings?.smsFrom ?? "", smsConfigured: Boolean(settings?.smsAccountId && settings?.smsAuthSecretEncrypted && settings?.smsFrom), registrationCodeConfigured: Boolean(code), pollinationsApiKeyConfigured: Boolean(current?.pollinationsApiKeyEncrypted), smtpPasswordConfigured: Boolean(mail.smtpPassword), membershipMessageRecipientLimit: current?.membershipMessageRecipientLimit ?? 200, prayerRequestsAdminEmail: current?.prayerRequestsAdminEmail ?? "", prayerRequestsSundayEmail: current?.prayerRequestsSundayEmail ?? "", prayerRequestsEldersEmail: current?.prayerRequestsEldersEmail ?? "", enabledModules, publicSiteEnabled: tenantSettings?.publicSiteEnabled ?? current?.publicSiteEnabled !== false, maintenanceMode: tenantSettings?.maintenanceMode ?? current?.maintenanceMode === true, siteName: current?.siteName ?? "St. Paul's", siteTagline: current?.siteTagline ?? "A place to belong.", adminSiteName: current?.adminSiteName ?? "Site administration", adminSiteTagline: current?.adminSiteTagline ?? "Management workspace", themeFamily: current?.themeFamily ?? "bootstrap", themeWidth: current?.themeWidth ?? "full", themeBackground: current?.themeBackground ?? "#f8f4ee", themeForeground: current?.themeForeground ?? "#17324d", themeAccent: current?.themeAccent ?? "#e66f51", themeSurface: current?.themeSurface ?? "#ffffff", themeButtonPrimary: current?.themeButtonPrimary ?? "#e66f51", themeButtonSecondary: current?.themeButtonSecondary ?? "#17324d", themeButtonDefault: current?.themeButtonDefault ?? "#ffffff", themeNotificationPrimary: current?.themeNotificationPrimary ?? "#e66f51", themeNotificationSecondary: current?.themeNotificationSecondary ?? "#17324d", themeNotificationDefault: current?.themeNotificationDefault ?? "#ffffff", themeNotificationSuccess: current?.themeNotificationSuccess ?? "#2f855a", themeNotificationWarning: current?.themeNotificationWarning ?? "#b7791f", themeNotificationDanger: current?.themeNotificationDanger ?? "#c53030", themeNotificationInfo: current?.themeNotificationInfo ?? "#287c8c", themeHeadingFont: current?.themeHeadingFont ?? "Lora", themeBodyFont: current?.themeBodyFont ?? "Inter", themeRadius: current?.themeRadius ?? "balanced", themeElevation: current?.themeElevation ?? "soft", themeButton: current?.themeButton ?? "pill", themeNav: current?.themeNav ?? "minimal", themeSpacing: current?.themeSpacing ?? "comfortable", themeContentBorder: current?.themeContentBorder ?? true });
  } catch {
    return NextResponse.json({ error: "Unable to load site settings." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  const enabledModules = input?.enabledModules === undefined ? undefined : normalizeModuleSlugs(input.enabledModules);
  const hasMessageLimit = input?.membershipMessageRecipientLimit !== undefined;
  const emailProviders = ["smtp", "sendgrid", "mailgun", "postmark", "resend", "amazon-ses"];
  if (!input || typeof input.siteName !== "string" || !input.siteName.trim() || typeof input.siteTagline !== "string" || typeof input.adminSiteName !== "string" || !input.adminSiteName.trim() || typeof input.adminSiteTagline !== "string" || typeof input.publicSiteEnabled !== "boolean" || (input.maintenanceMode !== undefined && typeof input.maintenanceMode !== "boolean") || typeof input.prayerRequestsAdminEmail !== "string" || typeof input.prayerRequestsSundayEmail !== "string" || typeof input.prayerRequestsEldersEmail !== "string" || (hasMessageLimit && (typeof input.membershipMessageRecipientLimit !== "number" || !Number.isInteger(input.membershipMessageRecipientLimit) || input.membershipMessageRecipientLimit < 1 || input.membershipMessageRecipientLimit > 5000)) || typeof input.smtpHost !== "string" || !Number.isInteger(input.smtpPort) || input.smtpPort < 1 || input.smtpPort > 65535 || typeof input.smtpUser !== "string" || typeof input.emailFrom !== "string" || (input.registrationCode !== undefined && typeof input.registrationCode !== "string") || !emailProviders.includes(input.emailProvider) || typeof input.emailApiDomain !== "string" || typeof input.emailApiRegion !== "string" || !["twilio", "vonage", "aws-sns"].includes(input.smsProvider) || typeof input.smsAccountId !== "string" || typeof input.smsFrom !== "string" || (input.smtpPassword !== undefined && typeof input.smtpPassword !== "string") || (input.emailApiKey !== undefined && typeof input.emailApiKey !== "string") || (input.emailApiSecret !== undefined && typeof input.emailApiSecret !== "string") || (input.smsAuthSecret !== undefined && typeof input.smsAuthSecret !== "string") || (input.pollinationsApiKey !== undefined && typeof input.pollinationsApiKey !== "string") || (input.enabledModules !== undefined && !enabledModules) || !isThemeFamily(input.themeFamily) || !isThemeWidth(input.themeWidth) || typeof input.themeContentBorder !== "boolean" || ![input.themeBackground, input.themeForeground, input.themeAccent, input.themeSurface, input.themeButtonPrimary, input.themeButtonSecondary, input.themeButtonDefault, input.themeNotificationPrimary, input.themeNotificationSecondary, input.themeNotificationDefault, input.themeNotificationSuccess, input.themeNotificationWarning, input.themeNotificationDanger, input.themeNotificationInfo].every(isHexColor) || typeof input.themeHeadingFont !== "string" || !input.themeHeadingFont.trim() || typeof input.themeBodyFont !== "string" || !input.themeBodyFont.trim() || !isThemeStyle(input.themeRadius, THEME_RADII) || !isThemeStyle(input.themeElevation, THEME_ELEVATIONS) || !isThemeStyle(input.themeButton, THEME_BUTTONS) || !isThemeStyle(input.themeNav, THEME_NAVS) || !isThemeStyle(input.themeSpacing, THEME_SPACING)) {
    return NextResponse.json({ error: "Invalid site settings." }, { status: 400 });
  }
  try {
    const settingsUser = await requirePermission("MANAGE_SETTINGS");
    if (enabledModules !== undefined && !(await hasPermission(settingsUser.id, "MANAGE_MODULES"))) {
      return NextResponse.json({ error: "Manage Modules permission is required." }, { status: 403 });
    }
    const current = await db.securitySettings.findUnique({ where: { id: 1 }, select: { smtpPasswordEncrypted: true, registrationCodeEncrypted: true, emailApiKeyEncrypted: true, emailApiSecretEncrypted: true, smsAuthSecretEncrypted: true, pollinationsApiKeyEncrypted: true } });
    const saved = await db.securitySettings.upsert({
      where: { id: 1 },
      update: {
        siteName: input.siteName.trim(), siteTagline: input.siteTagline.trim(), adminSiteName: input.adminSiteName.trim(), adminSiteTagline: input.adminSiteTagline.trim(),
        smtpHost: input.smtpHost.trim(), smtpPort: input.smtpPort, smtpUser: input.smtpUser.trim(), emailFrom: input.emailFrom.trim(),
        smtpPasswordEncrypted: input.smtpPassword ? encryptConfig(input.smtpPassword) : current?.smtpPasswordEncrypted ?? null,
        prayerRequestsAdminEmail: input.prayerRequestsAdminEmail.trim() || null, prayerRequestsSundayEmail: input.prayerRequestsSundayEmail.trim() || null, prayerRequestsEldersEmail: input.prayerRequestsEldersEmail.trim() || null,
        emailProvider: input.emailProvider, emailApiDomain: input.emailApiDomain.trim() || null, emailApiRegion: input.emailApiRegion.trim() || null,
        emailApiKeyEncrypted: input.emailApiKey ? encryptConfig(input.emailApiKey) : current?.emailApiKeyEncrypted ?? null,
        emailApiSecretEncrypted: input.emailApiSecret ? encryptConfig(input.emailApiSecret) : current?.emailApiSecretEncrypted ?? null,
        smsProvider: input.smsProvider, smsAccountId: input.smsAccountId.trim(), smsFrom: input.smsFrom.trim(), smsAuthSecretEncrypted: input.smsAuthSecret ? encryptConfig(input.smsAuthSecret) : current?.smsAuthSecretEncrypted ?? null,
        registrationCodeEncrypted: input.registrationCode ? encryptConfig(input.registrationCode) : current?.registrationCodeEncrypted ?? null,
        pollinationsApiKeyEncrypted: input.pollinationsApiKey ? encryptConfig(input.pollinationsApiKey) : current?.pollinationsApiKeyEncrypted ?? null,
        ...(enabledModules === undefined || enabledModules === null ? {} : { enabledModules }),
        publicSiteEnabled: input.publicSiteEnabled,
        maintenanceMode: input.maintenanceMode === true,
        ...(hasMessageLimit ? { membershipMessageRecipientLimit: input.membershipMessageRecipientLimit } : {}),
        themeFamily: input.themeFamily,
        themeWidth: input.themeWidth,
        themeBackground: input.themeBackground,
        themeForeground: input.themeForeground,
        themeAccent: input.themeAccent,
        themeSurface: input.themeSurface,
        themeButtonPrimary: input.themeButtonPrimary,
        themeButtonSecondary: input.themeButtonSecondary,
        themeButtonDefault: input.themeButtonDefault,
        themeNotificationPrimary: input.themeNotificationPrimary,
        themeNotificationSecondary: input.themeNotificationSecondary,
        themeNotificationDefault: input.themeNotificationDefault,
        themeNotificationSuccess: input.themeNotificationSuccess,
        themeNotificationWarning: input.themeNotificationWarning,
        themeNotificationDanger: input.themeNotificationDanger,
        themeNotificationInfo: input.themeNotificationInfo,
        themeHeadingFont: input.themeHeadingFont.trim(),
        themeBodyFont: input.themeBodyFont.trim()
        ,themeRadius: input.themeRadius
        ,themeElevation: input.themeElevation
        ,themeButton: input.themeButton
        ,themeNav: input.themeNav
        ,themeSpacing: input.themeSpacing
        ,themeContentBorder: input.themeContentBorder
      },
      create: { id: 1, siteName: input.siteName.trim(), adminSiteName: input.adminSiteName.trim(), adminSiteTagline: input.adminSiteTagline.trim(), prayerRequestsAdminEmail: input.prayerRequestsAdminEmail.trim() || null, prayerRequestsSundayEmail: input.prayerRequestsSundayEmail.trim() || null, prayerRequestsEldersEmail: input.prayerRequestsEldersEmail.trim() || null,  siteTagline: input.siteTagline.trim(), smtpHost: input.smtpHost.trim(), smtpPort: input.smtpPort, smtpUser: input.smtpUser.trim(), emailFrom: input.emailFrom.trim(), smtpPasswordEncrypted: input.smtpPassword ? encryptConfig(input.smtpPassword) : null, emailProvider: input.emailProvider, emailApiDomain: input.emailApiDomain.trim() || null, emailApiRegion: input.emailApiRegion.trim() || null, emailApiKeyEncrypted: input.emailApiKey ? encryptConfig(input.emailApiKey) : null, emailApiSecretEncrypted: input.emailApiSecret ? encryptConfig(input.emailApiSecret) : null, smsProvider: input.smsProvider, smsAccountId: input.smsAccountId.trim(), smsFrom: input.smsFrom.trim(), smsAuthSecretEncrypted: input.smsAuthSecret ? encryptConfig(input.smsAuthSecret) : null, registrationCodeEncrypted: input.registrationCode ? encryptConfig(input.registrationCode) : null, pollinationsApiKeyEncrypted: input.pollinationsApiKey ? encryptConfig(input.pollinationsApiKey) : null, enabledModules: enabledModules ?? [], publicSiteEnabled: input.publicSiteEnabled, maintenanceMode: input.maintenanceMode === true, membershipMessageRecipientLimit: hasMessageLimit ? input.membershipMessageRecipientLimit : 200, themeFamily: input.themeFamily, themeWidth: input.themeWidth, themeBackground: input.themeBackground, themeForeground: input.themeForeground, themeAccent: input.themeAccent, themeSurface: input.themeSurface, themeButtonPrimary: input.themeButtonPrimary, themeButtonSecondary: input.themeButtonSecondary, themeButtonDefault: input.themeButtonDefault, themeNotificationPrimary: input.themeNotificationPrimary, themeNotificationSecondary: input.themeNotificationSecondary, themeNotificationDefault: input.themeNotificationDefault, themeNotificationSuccess: input.themeNotificationSuccess, themeNotificationWarning: input.themeNotificationWarning, themeNotificationDanger: input.themeNotificationDanger, themeNotificationInfo: input.themeNotificationInfo, themeHeadingFont: input.themeHeadingFont.trim(), themeBodyFont: input.themeBodyFont.trim(), themeRadius: input.themeRadius, themeElevation: input.themeElevation, themeButton: input.themeButton, themeNav: input.themeNav, themeSpacing: input.themeSpacing, themeContentBorder: input.themeContentBorder }
    }).then(() => ({ saved: true }));
    if (settingsUser.churchId) await db.church.update({ where: { id: settingsUser.churchId }, data: { publicSiteEnabled: input.publicSiteEnabled, maintenanceMode: input.maintenanceMode === true } });
    return NextResponse.json(saved);
  } catch (error) {
    return apiErrorResponse(error, "Unable to save site settings.");
  }
}
