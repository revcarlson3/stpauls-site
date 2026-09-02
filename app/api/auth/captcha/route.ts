import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";

export function GET() {
  return NextResponse.json(createCaptcha(), { headers: { "Cache-Control": "no-store" } });
}
