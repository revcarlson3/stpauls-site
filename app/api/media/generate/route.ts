import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getPollinationsApiKey } from "@/lib/app-config";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { saveUploadedMediaFile } from "@/lib/media";

const dimensions = new Map([
  ["square", { width: 1024, height: 1024 }],
  ["landscape", { width: 1344, height: 768 }],
  ["portrait", { width: 768, height: 1344 }]
]);

export async function POST(request: Request) {
  try {
    const user = await requirePermission("EDIT_PAGES");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentGenerations = await db.auditLog.count({ where: { actorId: user.id, activityType: "ai-image-generated", createdAt: { gte: oneHourAgo } } });
    if (recentGenerations >= 10) return NextResponse.json({ error: "You have reached the limit of 10 AI images per hour. Please try again later." }, { status: 429 });
    const input = await request.json();
    const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";
    const size = typeof input?.size === "string" ? dimensions.get(input.size) : undefined;
    if (!prompt || prompt.length > 500 || !size) return NextResponse.json({ error: "Enter an image prompt of up to 500 characters and choose an image size." }, { status: 400 });

    const apiKey = await getPollinationsApiKey();
    if (!apiKey) return NextResponse.json({ error: "AI image generation is not configured. Add POLLINATIONS_API_KEY to the server environment." }, { status: 503 });

    const endpoint = (process.env.POLLINATIONS_API_URL ?? "https://gen.pollinations.ai/image").replace(/\/$/, "");
    const model = process.env.POLLINATIONS_MODEL ?? "flux";
    const url = new URL(`${endpoint}/${encodeURIComponent(prompt)}`);
    url.searchParams.set("width", String(size.width));
    url.searchParams.set("height", String(size.height));
    url.searchParams.set("model", model);
    url.searchParams.set("nologo", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    let generated: Response;
    try {
      generated = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!generated.ok) return NextResponse.json({ error: "The AI image provider could not create an image. Please try again shortly." }, { status: 502 });

    const mimeType = generated.headers.get("content-type")?.split(";")[0] ?? "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) return NextResponse.json({ error: "The AI image provider returned an unsupported image format." }, { status: 502 });
    const data = await generated.arrayBuffer();
    if (!data.byteLength || data.byteLength > 20 * 1024 * 1024) return NextResponse.json({ error: "The generated image was invalid or too large." }, { status: 502 });

    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const filename = `${randomUUID()}.${extension}`;
    const label = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
    const asset = await saveUploadedMediaFile({
      asset: new File([data], `ai-${filename}`, { type: mimeType }),
      filename,
      uploader: user,
      title: `AI image: ${label}`,
      altText: prompt,
      description: `AI-generated with Pollinations.AI (${model}). Prompt: ${prompt}`,
      tags: ["ai-generated"]
    });
    await logAudit({ activityType: "ai-image-generated", actorId: user.id, summary: "Generated an AI image", details: `Asset ID: ${asset.id}; model: ${model}` });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "The AI image provider took too long to respond. Please try again." }, { status: 504 });
    throw error;
  }
}
