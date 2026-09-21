import { db } from "@/lib/db";

export async function getOnlineGivingEnabled() {
  const settings = await db.securitySettings.findUnique({
    where: { id: 1 },
    select: { onlineGivingEnabled: true, tithelyEnvironment: true },
  });
  return (
    settings?.onlineGivingEnabled === true &&
    settings.tithelyEnvironment === "live"
  );
}
