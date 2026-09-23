import { NextResponse } from "next/server";
import { namecheapStatus, saveNamecheapConfig } from "@/lib/namecheap";
export async function GET() { try { return NextResponse.json(await namecheapStatus()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Namecheap status." }, { status: 500 }); } }
export async function POST(request: Request) { try { return NextResponse.json(await saveNamecheapConfig(await request.json())); } catch (error) { const message = error instanceof Error ? error.message : "Unable to save Namecheap configuration."; return NextResponse.json({ error: message }, { status: message === "Reauthentication required." ? 428 : 400 }); } }
