import { db } from "@/lib/db";

export async function notifyAccountingManagers(input: {
  senderId: string;
  title: string;
  message: string;
  link: string;
}) {
  const recipients = await db.user.findMany({
    where: {
      isActive: true,
      group: { permissions: { some: { permission: "MANAGE_ACCOUNTING" } } },
    },
    select: { id: true },
  });
  if (!recipients.length) return;
  await db.reportAutomationNotification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      senderId: input.senderId,
      title: input.title,
      message: input.message,
      category: "ACCOUNTING",
      link: input.link,
    })),
  });
}
