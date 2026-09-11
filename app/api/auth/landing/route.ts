import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isPublicSiteEnabled } from "@/lib/modules";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const publicSiteEnabled = await isPublicSiteEnabled();
  return NextResponse.json({
    destination: user.canAccessAdmin ? "/admin" : publicSiteEnabled ? "/" : "/account"
  });
}
