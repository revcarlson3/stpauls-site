"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { formatPhoneNumber } from "@/lib/phone-numbers";

type DirectoryMember = {
  id: string;
  firstName: string;
  lastName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  familyPhotoUrl: string | null;
  address: string;
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

  return <main className="py-12 sm:py-16"><Container>
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member access</p>
    <h1 className="mt-2 font-serif text-4xl">Member directory</h1>
    <p className="mt-3 max-w-2xl text-ink/60">This directory is available only to signed-in accounts. Members and families who have chosen not to be listed are omitted.</p>
    <label className="mt-7 grid max-w-xl gap-1 text-sm font-semibold">Search directory<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or family" className="focus-ring rounded-lg border border-ink/15 bg-white px-3 py-2 font-normal" /></label>
    {error ? <p role="alert" className="mt-6 text-sm font-semibold text-coral">{error}</p> : <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
      {visibleMembers.map((member) => <article key={member.id} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        {member.familyPhotoUrl && <img src={member.familyPhotoUrl} alt={`${member.familyName} family`} className="mb-4 aspect-[4/3] w-full rounded-xl object-cover" />}
        <h2 className="font-serif text-2xl">{member.firstName} {member.lastName}</h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-coral">{member.familyName}</p>
        <dl className="mt-4 grid gap-2 text-sm">
          {member.email && <div><dt className="font-semibold text-ink/55">Email</dt><dd><a className="hover:text-coral" href={`mailto:${member.email}`}>{member.email}</a></dd></div>}
          {member.phone && <div><dt className="font-semibold text-ink/55">Phone</dt><dd>{formatPhoneNumber(member.phone)}</dd></div>}
          {member.address && <div><dt className="font-semibold text-ink/55">Address</dt><dd>{member.address}</dd></div>}
        </dl>
      </article>)}
      {!visibleMembers.length && <p className="text-sm text-ink/60">{members.length ? "No directory entries match your search." : "No members are currently listed."}</p>}
    </div>}
  </Container></main>;
}
