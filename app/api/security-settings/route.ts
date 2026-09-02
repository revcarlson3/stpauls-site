import { NextResponse } from "next/server";
import { getSecuritySettings, updateSecuritySettings } from "@/lib/security-settings";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try { await requirePermission("MANAGE_SETTINGS"); return NextResponse.json(await getSecuritySettings()); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 }); return NextResponse.json({ error: "Unable to load security settings." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  if (!input || typeof input.loginProtectionEnabled !== "boolean" || !Number.isInteger(input.maxFailedAttempts) || input.maxFailedAttempts < 1 || input.maxFailedAttempts > 20 || !Number.isInteger(input.lockoutMinutes) || input.lockoutMinutes < 1 || input.lockoutMinutes > 1440) return NextResponse.json({ error: "Invalid login protection settings." }, { status: 400 });
  try { return NextResponse.json(await updateSecuritySettings(input)); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 }); return NextResponse.json({ error: "Unable to save security settings." }, { status: 500 }); }
}
