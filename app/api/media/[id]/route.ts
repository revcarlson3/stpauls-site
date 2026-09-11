import { NextResponse } from "next/server";
import { deleteMediaAsset, editMediaAsset, updateMediaAsset } from "@/lib/media";
import { requirePermission } from "@/lib/auth";
import { parseMediaAssetUpdateInput } from "@/lib/media-input";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const input = parseMediaAssetUpdateInput(await request.json());
  if (!input) return NextResponse.json({ error: "Invalid media asset input." }, { status: 400 });
  try {
    return NextResponse.json(await updateMediaAsset(params.id, input));
  } catch (error) {
    if (error instanceof Error && error.message === "Media asset not found.") return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && error.message.startsWith("Cannot delete linked")) return NextResponse.json({ error: error.message }, { status: 409 });
    return unauthorizedResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await deleteMediaAsset(params.id));
  } catch (error) {
    if (error instanceof Error && error.message === "Media asset not found.") return NextResponse.json({ error: error.message }, { status: 404 });
    return unauthorizedResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("EDIT_PAGES");
    const input = await request.json();
    if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid image edit input." }, { status: 400 });
    return NextResponse.json(await editMediaAsset({
      assetId: params.id,
      crop: isCrop(input.crop) ? input.crop : undefined,
      width: isPositiveNumber(input.width) ? input.width : undefined,
      height: isPositiveNumber(input.height) ? input.height : undefined,
      rotate: input.rotate === 90 || input.rotate === 180 || input.rotate === 270 ? input.rotate : 0,
      flipHorizontal: input.flipHorizontal === true,
      flipVertical: input.flipVertical === true,
      uploader: user
    }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["Media asset not found.", "Media file not found."].includes(error.message)) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && error.message.includes("Only ")) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && (error.message.includes("crop") || error.message.includes("Resize") || error.message.includes("dimensions"))) return NextResponse.json({ error: error.message }, { status: 400 });
    return unauthorizedResponse(error);
  }
}

function unauthorizedResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  throw error;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isCrop(value: unknown): value is { left: number; top: number; width: number; height: number } {
  return !!value && typeof value === "object" &&
    isNonNegativeNumber((value as { left?: unknown }).left) &&
    isNonNegativeNumber((value as { top?: unknown }).top) &&
    isPositiveNumber((value as { width?: unknown }).width) &&
    isPositiveNumber((value as { height?: unknown }).height);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
