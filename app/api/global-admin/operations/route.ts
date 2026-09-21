import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { getGlobalAdminOperations } from "@/lib/global-admin-operations";

export async function GET() {
  try {
    await requireGlobalAdmin();
    return NextResponse.json(await getGlobalAdminOperations());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Global administrator access is required." }, { status: 403 });
    }
    console.error("Global admin operations could not be loaded.", error);
    return NextResponse.json({ error: "Unable to load platform operations." }, { status: 500 });
  }
}
