import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeReportModule } from "@/lib/reporting";

async function authorize(churchId?: string) {
  const scope = await authorizeReportModule({ module: "giving", churchId });
  return { user: scope.user, church: { id: scope.churchId } };
}

export async function GET(request: Request) {
  try {
    const { church } = await authorize(new URL(request.url).searchParams.get("churchId") || undefined);
    const reports = await db.givingReport.findMany({
      where: { churchId: church.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        reportType: true,
        criteria: true,
        columns: true,
        sort: true,
        grouping: true,
        layout: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Unable to load giving reports." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const { user, church } = await authorize(typeof input?.churchId === "string" ? input.churchId : undefined);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Enter a report name no longer than 200 characters." }, { status: 400 });
    }
    const report = await db.givingReport.create({
      data: {
        churchId: church.id,
        createdById: user.id,
        name,
        description: typeof input.description === "string" ? input.description.trim() || null : null,
        reportType: typeof input.reportType === "string" ? input.reportType : "custom",
        criteria: input.criteria ?? {},
        columns: input.columns ?? [],
        sort: input.sort ?? [],
        grouping: input.grouping ?? {},
        layout: input.layout ?? {},
      },
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to save giving report." }, { status: 400 });
  }
}
