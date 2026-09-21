import Link from "next/link";

export function GlobalAdminBackLink() {
  return (
    <Link href="/global-admin" className="focus-ring inline-flex rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">
      Back to control plane
    </Link>
  );
}
