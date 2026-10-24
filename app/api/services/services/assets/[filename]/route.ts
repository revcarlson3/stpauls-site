import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const directory = path.join(process.cwd(), "storage", "services", "worship");
const contentTypes: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_: Request, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename);
  const extension = path.extname(filename).toLowerCase();
  const contentType = contentTypes[extension];
  if (!contentType || filename !== params.filename) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  try {
    const contents = await readFile(path.join(directory, filename));
    return new NextResponse(contents, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }
}
