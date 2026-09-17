import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { contactDisplayName } from "@/lib/accounting-contacts";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return church;
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || null : null; }

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const existing = await db.accountingContact.findFirst({ where: { id: params.id, churchId: church.id } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    const input = await request.json();
    const contactType = input?.contactType === "BUSINESS" ? "BUSINESS" : "PERSON";
    const firstName = clean(input?.firstName, 80);
    const lastName = clean(input?.lastName, 80);
    const businessName = clean(input?.businessName, 160);
    if ((contactType === "BUSINESS" && !businessName) || (contactType === "PERSON" && !firstName && !lastName)) return NextResponse.json({ error: "Enter a contact name." }, { status: 400 });
    const contact = await db.accountingContact.update({ where: { id: existing.id }, data: { contactType, firstName, lastName, businessName, address: clean(input?.address, 200), city: clean(input?.city, 80), state: clean(input?.state, 40), postalCode: clean(input?.postalCode, 30), phone: clean(input?.phone, 60), email: clean(input?.email, 160), notes: clean(input?.notes, 1000), isActive: typeof input?.isActive === "boolean" ? input.isActive : existing.isActive } });
    return NextResponse.json({ contact: { ...contact, displayName: contactDisplayName(contact) } });
  } catch { return NextResponse.json({ error: "Unable to update contact." }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const existing = await db.accountingContact.findFirst({ where: { id: params.id, churchId: church.id } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    await db.accountingContact.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to delete contact." }, { status: 400 }); }
}
