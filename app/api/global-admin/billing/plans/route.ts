import { NextResponse } from "next/server";
import { createGlobalPlan, listGlobalPlans } from "@/lib/global-admin-plans";
export async function GET() { try { return NextResponse.json(await listGlobalPlans()); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load plans." }, { status: 403 }); } }
export async function POST(request: Request) { try { return NextResponse.json(await createGlobalPlan(await request.json()), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create plan." }, { status: 400 }); } }
