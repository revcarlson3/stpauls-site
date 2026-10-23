import { NextResponse } from "next/server";
import { getMediaOptimizationSetting, setMediaOptimizationSetting } from "@/lib/media";

export async function GET() {
  try {
    return NextResponse.json(await getMediaOptimizationSetting());
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    if (typeof input?.enabled !== "boolean") return NextResponse.json({ error: "The optimization setting must be a boolean." }, { status: 400 });
    return NextResponse.json(await setMediaOptimizationSetting(input.enabled));
  } catch (error) {
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}
