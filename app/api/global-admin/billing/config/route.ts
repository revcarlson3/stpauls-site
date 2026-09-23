import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";
import { billingConfigStatus, encryptBillingSecret, validateBillingConfig } from "@/lib/billing-config";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try { await requireGlobalAdmin(); return NextResponse.json({ configurations: await billingConfigStatus() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load provider configuration." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const context = await requireGlobalAdmin({ sensitive: true });
    const input = await request.json();
    validateBillingConfig(input);
    const provider = input.provider as "STRIPE" | "PAYPAL";
    const environment = input.environment as "TEST" | "LIVE";
    const existing = await db.billingProviderConfiguration.findUnique({ where: { provider_environment: { provider, environment } } });
    const secret = (name: string) => typeof input[name] === "string" && input[name] ? encryptBillingSecret(input[name]) : undefined;
    const values = provider === "STRIPE"
      ? { stripeSecretKeyEncrypted: secret("secretKey"), stripeWebhookSecretEncrypted: secret("webhookSecret") }
      : { paypalClientIdEncrypted: secret("clientId"), paypalClientSecretEncrypted: secret("clientSecret"), paypalWebhookIdEncrypted: secret("webhookId"), paypalApiBaseUrl: input.apiBaseUrl || undefined };
    await db.billingProviderConfiguration.upsert({ where: { provider_environment: { provider, environment } }, create: { provider, environment, ...values }, update: values });
    await logAudit({ activityType: "billing-provider-configuration-updated", summary: `Updated ${provider} billing provider configuration (${environment}).`, actorId: context.user.id, details: buildGlobalAuditDetails({ churchId: "platform", targetType: "billing-provider-configuration", targetId: `${provider}:${environment}`, metadata: { provider, environment, secretFieldsUpdated: Object.keys(values).filter((key) => key.endsWith("Encrypted")) } }) });
    return NextResponse.json({ configurations: await billingConfigStatus() });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update provider configuration." }, { status: 400 }); }
}
