import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { decryptConfig, encryptConfig } from "@/lib/app-config";

export async function GET(request: Request) {
  const requestedEnvironment = new URL(request.url).searchParams.get("environment");
  const settings = await db.securitySettings.findUnique({
    where: { id: 1 },
    select: {
      onlineGivingEnabled: true,
      tithelyPublicKey: true,
      tithelyPrivateKeyEncrypted: true,
      tithelyOrganizationId: true,
      tithelyEnvironment: true,
      tithelyTestPublicKey: true,
      tithelyTestPrivateKeyEncrypted: true,
      tithelyTestOrganizationId: true,
      tithelyLivePublicKey: true,
      tithelyLivePrivateKeyEncrypted: true,
      tithelyLiveOrganizationId: true,
    },
  });
  const environment =
    requestedEnvironment === "live"
      ? "live"
      : requestedEnvironment === "test"
        ? "test"
        : settings?.tithelyEnvironment === "live"
          ? "live"
          : "test";
  const isLive = environment === "live";
  const hasEnvironmentCredentials =
    Boolean(settings?.tithelyTestPublicKey) ||
    Boolean(settings?.tithelyLivePublicKey);
  const useLegacyCredentials =
    !hasEnvironmentCredentials && settings?.tithelyEnvironment === environment;
  const publicKey =
    (isLive ? settings?.tithelyLivePublicKey : settings?.tithelyTestPublicKey) ??
    (useLegacyCredentials ? settings?.tithelyPublicKey : "") ??
    "";
  const privateKeyConfigured = Boolean(
    (isLive
      ? settings?.tithelyLivePrivateKeyEncrypted
      : settings?.tithelyTestPrivateKeyEncrypted) ??
      (useLegacyCredentials ? settings?.tithelyPrivateKeyEncrypted : null),
  );
  const organizationId =
    (isLive
      ? settings?.tithelyLiveOrganizationId
      : settings?.tithelyTestOrganizationId) ??
    (useLegacyCredentials ? settings?.tithelyOrganizationId : "") ??
    "";
  return NextResponse.json(
    {
      enabled: settings?.onlineGivingEnabled === true,
      tithelyPublicKey: publicKey,
      tithelyPrivateKeyConfigured: privateKeyConfigured,
      tithelyOrganizationId: organizationId,
      tithelyEnvironment: environment,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const input = await request.json();
    if (
      typeof input?.enabled !== "boolean" ||
      (input.environment !== undefined &&
        input.environment !== "test" &&
        input.environment !== "live") ||
      (input.publicKey !== undefined && typeof input.publicKey !== "string") ||
      (input.privateKey !== undefined && typeof input.privateKey !== "string") ||
      (input.organizationId !== undefined &&
        typeof input.organizationId !== "string")
    ) {
      return NextResponse.json(
        { error: "A valid online giving setting is required." },
        { status: 400 },
      );
    }
    const environment = input.environment ?? "test";
    const isLive = environment === "live";
    const environmentFields = isLive
      ? {
          tithelyLivePublicKey:
            input.publicKey !== undefined ? input.publicKey.trim() || null : undefined,
          tithelyLivePrivateKeyEncrypted: input.privateKey?.trim()
            ? encryptConfig(input.privateKey.trim())
            : undefined,
          tithelyLiveOrganizationId:
            input.organizationId !== undefined
              ? input.organizationId.trim() || null
              : undefined,
        }
      : {
          tithelyTestPublicKey:
            input.publicKey !== undefined ? input.publicKey.trim() || null : undefined,
          tithelyTestPrivateKeyEncrypted: input.privateKey?.trim()
            ? encryptConfig(input.privateKey.trim())
            : undefined,
          tithelyTestOrganizationId:
            input.organizationId !== undefined
              ? input.organizationId.trim() || null
              : undefined,
        };
    await db.securitySettings.upsert({
      where: { id: 1 },
      update: {
        onlineGivingEnabled: input.enabled,
        tithelyEnvironment: environment,
        ...environmentFields,
      },
      create: {
        id: 1,
        onlineGivingEnabled: input.enabled,
        tithelyEnvironment: environment,
        ...(isLive
          ? {
              tithelyLivePublicKey: input.publicKey?.trim() || null,
              tithelyLivePrivateKeyEncrypted: input.privateKey?.trim()
                ? encryptConfig(input.privateKey.trim())
                : null,
              tithelyLiveOrganizationId: input.organizationId?.trim() || null,
            }
          : {
              tithelyTestPublicKey: input.publicKey?.trim() || null,
              tithelyTestPrivateKeyEncrypted: input.privateKey?.trim()
                ? encryptConfig(input.privateKey.trim())
                : null,
              tithelyTestOrganizationId: input.organizationId?.trim() || null,
            }),
      },
    });
    return NextResponse.json({
      enabled: input.enabled,
      tithelyPrivateKeyConfigured: Boolean(input.privateKey?.trim()),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to update online giving." },
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const settings = await db.securitySettings.findUnique({
      where: { id: 1 },
      select: {
        tithelyEnvironment: true,
        tithelyPublicKey: true,
        tithelyPrivateKeyEncrypted: true,
        tithelyOrganizationId: true,
        tithelyTestPublicKey: true,
        tithelyTestPrivateKeyEncrypted: true,
        tithelyTestOrganizationId: true,
      },
    });

    if (settings?.tithelyEnvironment !== "test") {
      return NextResponse.json(
        { error: "The Tithe.ly test charge is available only in the test environment." },
        { status: 400 },
      );
    }

    const publicKey = settings.tithelyTestPublicKey ?? settings.tithelyPublicKey;
    const privateKey = decryptConfig(
      settings.tithelyTestPrivateKeyEncrypted ??
        settings.tithelyPrivateKeyEncrypted,
    );
    const organizationId =
      settings.tithelyTestOrganizationId ?? settings.tithelyOrganizationId;
    if (!publicKey || !privateKey || !organizationId) {
      return NextResponse.json(
        { error: "Save the Tithe.ly public key, private key, and organization ID first." },
        { status: 400 },
      );
    }

    const input = await request.json();
    const amount = Number(input?.amount);
    const email = typeof input?.email === "string" ? input.email.trim() : "";
    const firstName = typeof input?.firstName === "string" ? input.firstName.trim() : "";
    const lastName = typeof input?.lastName === "string" ? input.lastName.trim() : "";
    const token = typeof input?.token === "string" ? input.token.trim() : "";
    const givingType =
      typeof input?.givingType === "string" ? input.givingType.trim() : "";

    if (
      !Number.isInteger(amount) ||
      amount < 50 ||
      amount > 1_000_000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !firstName ||
      !lastName ||
      !givingType ||
      givingType.length > 100 ||
      !token ||
      token.length > 500
    ) {
      return NextResponse.json(
        { error: "Enter valid donor details, a giving type, and a test amount from $0.50 to $10,000." },
        { status: 400 },
      );
    }

    const response = await fetch("https://tithelydev.com/api/v1/charge-once", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey}:${privateKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        token,
        organization_id: organizationId,
        amount,
        giving_type: givingType,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const upstreamError =
        result && typeof result.error === "string" ? result.error : "";
      return NextResponse.json(
        { error: upstreamError || "Tithe.ly rejected the test charge." },
        { status: 502 },
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Tithe.ly test charge failed.", error);
    return NextResponse.json(
      { error: "Unable to complete the Tithe.ly test charge." },
      { status: 500 },
    );
  }
}
