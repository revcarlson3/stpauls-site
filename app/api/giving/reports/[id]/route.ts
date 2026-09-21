import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeReportModule } from "@/lib/reporting";

async function authorize(churchId?: string) {
  const scope = await authorizeReportModule({ module: "giving", churchId });
  return { id: scope.churchId };
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const input = await request.json();
    const church = await authorize(typeof input?.churchId === "string" ? input.churchId : undefined);
    const report = await db.givingReport.updateMany({
      where: { id: context.params.id, churchId: church.id },
      data: {
        name: typeof input?.name === "string" ? input.name.trim() : undefined,
        description: typeof input?.description === "string" ? input.description.trim() || null : undefined,
        reportType: typeof input?.reportType === "string" ? input.reportType : undefined,
        criteria: input.criteria,
        columns: input.columns,
        sort: input.sort,
        grouping: input.grouping,
        layout: input.layout,
      },
    });
    if (!report.count) return NextResponse.json({ error: "Giving report not found." }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Unable to update giving report." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const church = await authorize(new URL(_request.url).searchParams.get("churchId") || undefined);
    const result = await db.givingReport.deleteMany({ where: { id: context.params.id, churchId: church.id } });
    if (!result.count) return NextResponse.json({ error: "Giving report not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete giving report." }, { status: 400 });
  }
}
