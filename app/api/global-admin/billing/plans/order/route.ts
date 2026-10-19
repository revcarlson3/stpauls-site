import { NextResponse } from "next/server";
import { reorderGlobalPlans } from "@/lib/global-admin-plans";
export async function POST(request: Request) { try { const body = await request.json(); if (!Array.isArray(body.ids) || !body.ids.every((id: unknown) => typeof id === "string")) throw new Error("ids must be an array of plan IDs."); return NextResponse.json(await reorderGlobalPlans(body.ids)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reorder plans." }, { status: 400 }); } }
