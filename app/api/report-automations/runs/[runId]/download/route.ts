import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { runId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  const run = await db.reportAutomationRun.findUnique({ where: { id: params.runId }, include: { automation: true } });
  if (!run) return NextResponse.json({ error: "Report run not found." }, { status: 404 });
  const recipients = Array.isArray(run.automation.recipients) ? run.automation.recipients : [];
  if (run.automation.createdById !== user.id && !recipients.includes(account?.email ?? "")) return NextResponse.json({ error: "Report access denied." }, { status: 403 });
  const attachment = run.attachment && typeof run.attachment === "object" ? run.attachment as { fileName?: string; contentBase64?: string; contentType?: string } : {};
  if (!attachment.contentBase64) return NextResponse.json({ error: "This report run has no attachment." }, { status: 404 });
  return new NextResponse(Buffer.from(attachment.contentBase64, "base64"), {
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${String(attachment.fileName || "report").replace(/["\r\n]/g, "_")}"`
    }
  });
}
