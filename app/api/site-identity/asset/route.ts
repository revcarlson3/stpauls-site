import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export async function GET(request: Request) {
  const assetPath = new URL(request.url).searchParams.get("path") || "";
  if (!assetPath.startsWith("/uploads/site-identity/") || assetPath.includes("..")) {
    return NextResponse.json({ error: "Invalid identity asset." }, { status: 400 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), "public", assetPath));
    const extension = path.extname(assetPath).toLowerCase();
    return new NextResponse(file, { headers: { "Content-Type": contentTypes[extension] || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Identity asset not found." }, { status: 404 });
  }
}
