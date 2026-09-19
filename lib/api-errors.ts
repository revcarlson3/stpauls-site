import { NextResponse } from "next/server";

export function apiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
    const status = error.message.includes("required permission") ? 403 : 401;
    return NextResponse.json({ error: status === 401 ? "Authentication required." : "You do not have permission to perform this action." }, { status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
