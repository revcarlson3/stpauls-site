import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { getGlobalHealth } from "@/lib/global-admin-health";
export async function GET() { try { await requireGlobalAdmin(); const health = await getGlobalHealth(); return NextResponse.json(health, { status: health.status === "ready" ? 200 : 503 }); } catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Global administrator access is required." }, { status: 403 }); return NextResponse.json({ error: "Unable to read platform health." }, { status: 503 }); } }
