import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGlobalAdmin } from "@/lib/global-admin";

export async function GET() {
  let context;
  try {
    context = await requireGlobalAdmin({ selectedChurch: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
      return NextResponse.json({ error: "Bridge access and a selected site are required." }, { status: 403 });
    }
    return NextResponse.json({ error: "A selected site is required." }, { status: 409 });
  }

  const churchId = context.church!.id;
  const [church, activeUsers] = await Promise.all([
    db.church.findUnique({
      where: { id: churchId },
      select: {
        name: true,
        slug: true,
        city: true,
        state: true,
        status: true,
        lifecycleStatus: true,
        onboardingStatus: true,
        onboardingStep: true,
        createdAt: true
      }
    }),
    db.churchUser.count({ where: { churchId, user: { isActive: true } } })
  ]);

  if (!church) return NextResponse.json({ error: "The selected site is unavailable." }, { status: 404 });

  return NextResponse.json({
    site: {
      name: church.name,
      slug: church.slug,
      location: [church.city, church.state].filter(Boolean).join(", ") || null,
      status: church.status,
      createdAt: church.createdAt.toISOString()
    },
    lifecycle: {
      status: church.lifecycleStatus,
      onboardingStatus: church.onboardingStatus,
      currentStep: church.onboardingStep ?? null
    },
    health: {
      users: activeUsers,
      activeUsers
    },
    setup: {
      siteIdentity: false,
      modules: false,
      security: false
    },
    recentActions: []
  });
}
