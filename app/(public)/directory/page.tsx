"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { formatPhoneNumber } from "@/lib/phone-numbers";
import { buildVCard } from "@/lib/vcard";

type DirectoryMember = {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  familyPhotoUrl: string | null;
  address: string;
};

type DirectoryFamily = {
  familyId: string;
  familyName: string;
  familyPhotoUrl: string | null;
  address: string;
  members: DirectoryMember[];
};

export default function MemberDirectoryPage() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/membership/directory").then(async (response) => {
      const value = await response.json();
      if (response.status === 401 || response.status === 403) {
        router.replace("/account");
        return;
      }
      if (!response.ok) throw new Error(value.error ?? "Unable to load the member directory.");
      setMembers(value.members ?? []);
    }).catch((reason: Error) => setError(reason.message));
  }, [router]);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return members;
    return members.filter((member) => `${member.firstName} ${member.lastName} ${member.familyName}`.toLocaleLowerCase().includes(query));
  }, [members, search]);
  const visibleFamilies = useMemo(() => {
    const families = new Map<string, DirectoryFamily>();
    visibleMembers.forEach((member) => {
      const family = families.get(member.familyId) ?? {
        familyId: member.familyId,
        familyName: member.familyName,
        familyPhotoUrl: member.familyPhotoUrl,
        address: member.address,
        members: []
      };
      family.members.push(member);
      families.set(member.familyId, family);
    });
    return Array.from(families.values());
  }, [visibleMembers]);

  function downloadContact(member: DirectoryMember) {
    const blob = new Blob([buildVCard(member)], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${member.firstName}-${member.lastName}.vcf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="py-12 sm:py-16"><Container>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member access</p>
    <h1 className="mt-2 font-serif text-4xl">Member directory</h1>
    <p className="mt-3 max-w-2xl text-ink/60">This directory is available only to signed-in accounts. Members and families who have chosen not to be listed are omitted.</p>
    <label className="mt-7 grid max-w-xl gap-1 text-sm font-semibold">Search directory<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or family" className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label>
    {error ? <p role="alert" className="mt-6 text-sm font-semibold text-coral">{error}</p> : <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
      {visibleFamilies.map((family) => <article key={family.familyId} className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        {family.familyPhotoUrl && <img src={family.familyPhotoUrl} alt={`${family.familyName} family`} className="aspect-[4/3] w-full object-cover" />}
        <div className="p-5">
          <h2 className="font-serif text-2xl">{family.familyName}</h2>
          <div className="mt-4 grid gap-4">
            {family.members.map((member) => <section key={member.id} className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0">
              <h3 className="font-semibold">{member.firstName} {member.lastName}</h3>
              <dl className="mt-2 grid gap-2 text-sm">
                {member.email && <div><dt className="font-semibold text-ink/55">Email</dt><dd><a className="break-words hover:text-coral" href={`mailto:${member.email}`}>{member.email}</a></dd></div>}
                {member.phone && <div><dt className="font-semibold text-ink/55">Phone</dt><dd>{formatPhoneNumber(member.phone)}</dd></div>}
              </dl>
              <button type="button" className="focus-ring mt-3 rounded-full border border-ink/20 px-3 py-1.5 text-xs font-semibold hover:border-coral hover:text-coral" onClick={() => downloadContact(member)}>Add to contacts</button>
            </section>)}
          </div>
          {family.address && <p className="mt-4 border-t border-ink/10 pt-4 text-sm"><span className="font-semibold text-ink/55">Address</span><br />{family.address}</p>}
        </div>
      </article>)}
      {!visibleFamilies.length && <p className="text-sm text-ink/60">{members.length ? "No directory entries match your search." : "No members are currently listed."}</p>}
    </div>}
  </Container></main>;
}
