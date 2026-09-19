import { getSelectedSiteSupportAttachment } from "@/lib/global-admin-support";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const attachment = await getSelectedSiteSupportAttachment(params.id);
    if (!attachment) return new Response("Attachment not found.", { status: 404 });
    return new Response(new Uint8Array(attachment.data), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `attachment; filename="${attachment.originalName.replace(/["\r\n]/g, "")}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return new Response("Bridge access is required.", { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return new Response(error.message, { status: 409 });
    return new Response("Attachment not found.", { status: 404 });
  }
}
