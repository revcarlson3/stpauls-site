import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function DELETE(request: Request) {
  const channel = new URL(request.url).searchParams.get("channel");
  if (channel !== "EMAIL" && channel !== "SMS") return NextResponse.json({ error: "Invalid messaging channel." }, { status: 400 });
  try {
    await requirePermission("MANAGE_SETTINGS");
    if (channel === "EMAIL") {
      await db.securitySettings.updateMany({ where: { id: 1 }, data: { emailProvider: "smtp", smtpHost: null, smtpUser: null, smtpPasswordEncrypted: null, emailApiKeyEncrypted: null, emailApiSecretEncrypted: null, emailApiDomain: null, emailApiRegion: null, emailFrom: null } });
    } else {
      await db.securitySettings.updateMany({ where: { id: 1 }, data: { smsProvider: "twilio", smsAccountId: null, smsAuthSecretEncrypted: null, smsFrom: null } });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    throw error;
  }
}
