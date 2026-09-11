import { Container } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { MembershipImport } from "./membership-import";

export default async function MembershipImportPage() {
  const user = await requirePermission("MANAGE_MEMBERSHIP");
  await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
  const customFields = await db.membershipCustomFieldDefinition.findMany({
    where: { isActive: true, appliesTo: { in: ["FAMILY", "INDIVIDUAL"] } },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, appliesTo: true }
  });

  return <main>
    <Container className="py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Membership</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 font-serif text-4xl">Import members and families</h1>
          <p className="mt-3 max-w-3xl text-ink/60">Upload or paste CSV data, review every row, choose how duplicates are handled, and then commit all valid rows in one transaction.</p>
        </div>
        <a href="/admin/membership" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Back to directory</a>
      </div>
      <MembershipImport customFields={customFields.map((field) => ({ ...field, appliesTo: field.appliesTo as "FAMILY" | "INDIVIDUAL" }))} />
    </Container>
  </main>;
}
