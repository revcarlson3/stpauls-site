import { NextResponse } from "next/server";
import { onePanelStatus, saveOnePanelConfig, testOnePanelConnection } from "@/lib/onepanel";

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process 1Panel configuration.";
  return NextResponse.json({ error: message }, { status: message === "Reauthentication required." ? 428 : 400 });
}

export async function GET() {
  try { return NextResponse.json(await onePanelStatus()); } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  try { return NextResponse.json(await saveOnePanelConfig(await request.json())); } catch (error) { return responseError(error); }
}

export async function PUT() {
  try { return NextResponse.json(await testOnePanelConnection()); } catch (error) { return responseError(error); }
}
