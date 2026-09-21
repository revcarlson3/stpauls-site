import { db } from "@/lib/db";

export function contactDisplayName(contact: { contactType: string; firstName: string | null; lastName: string | null; businessName: string | null }) {
  if (contact.contactType === "BUSINESS") return contact.businessName?.trim() ?? "";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

export async function ensureAccountingContact(churchId: string, input: Record<string, unknown>) {
  const contactId = typeof input.contactId === "string" ? input.contactId : "";
  if (contactId) {
    const contact = await db.accountingContact.findFirst({ where: { id: contactId, churchId, isActive: true } });
    return contact ? contactDisplayName(contact) : "";
  }
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
  if (!description) return "";
  const existing = await db.accountingContact.findMany({ where: { churchId, isActive: true } });
  const match = existing.find((contact) => contactDisplayName(contact).toLocaleLowerCase() === description.toLocaleLowerCase());
  if (match) return description;
  await db.accountingContact.create({ data: { churchId, contactType: "PERSON", firstName: description } });
  return description;
}
