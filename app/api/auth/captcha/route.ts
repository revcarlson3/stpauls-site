import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";
import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.securitySettings.findUnique({ where: { id: 1 }, select: { captchaMode: true } });
  return NextResponse.json(settings?.captchaMode === "challenge" ? createCaptcha() : null, { headers: { "Cache-Control": "no-store" } });
}
