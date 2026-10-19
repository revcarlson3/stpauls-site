import { NextResponse } from "next/server";
import { setGlobalPlanActive, updateGlobalPlan } from "@/lib/global-admin-plans";
export async function PATCH(request: Request, { params }: { params: { id: string } }) { try { const body = await request.json(); return NextResponse.json("isActive" in body && Object.keys(body).length === 1 ? await setGlobalPlanActive(params.id, body.isActive === true) : await updateGlobalPlan(params.id, body)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update plan." }, { status: 400 }); } }
