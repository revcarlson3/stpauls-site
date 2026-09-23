import { NextResponse } from "next/server";
import { createGlobalCoupon, listGlobalCoupons } from "@/lib/global-admin-coupons";
export async function GET(request: Request) { try { return NextResponse.json(await listGlobalCoupons(new URL(request.url).searchParams.get("search") || "")); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load coupons." }, { status: 403 }); } }
export async function POST(request: Request) { try { return NextResponse.json(await createGlobalCoupon(await request.json()), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create coupon." }, { status: 400 }); } }
