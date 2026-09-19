import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOnlineGivingEnabled } from "@/lib/online-giving";

const features = [
  { href: "/account/membership/profile", label: "Member profile", description: "View and update the membership information your church has enabled.", image: "/member-center/profile.svg", imageAlt: "Abstract portrait representing a member profile" },
  { href: "/account/membership/prayer-requests", label: "Prayer requests", description: "Submit a request and review the requests currently connected to your account.", image: "/member-center/prayer-requests.svg", imageAlt: "Abstract heart and cross representing prayer requests" },
  { href: "/account/membership/scheduling", label: "Scheduling", description: "See your volunteer groups, upcoming events, and scheduled opportunities.", image: "/member-center/scheduling.svg", imageAlt: "Abstract calendar with check marks representing scheduling" },
  { href: "/account/membership/giving", label: "Online giving", description: "Give securely through the church’s Tithe.ly giving form.", image: "/member-center/giving.svg", imageAlt: "Abstract heart with a cross representing online giving" },
  { href: "/account/membership/giving-history", label: "Giving history and pledges", description: "Available when the Giving and Pledges module is enabled.", image: "/member-center/giving-history.svg", imageAlt: "Abstract upward trend representing giving history and pledges" },
  { href: "/account/membership/documents", label: "Documents and forms", description: "Find documents and forms shared with members by the church.", image: "/member-center/documents.svg", imageAlt: "Abstract document representing shared forms and documents" }
];

export default async function MembershipLandingPage() {
  const user = await getCurrentUser();
  const memberLink = user ? await db.membershipUserMemberLink.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const onlineGivingEnabled = await getOnlineGivingEnabled();
  const availableFeatures = (memberLink ? [{ href: "/directory", label: "Member directory", description: "Find contact information for members and families who have chosen to be listed.", image: "/member-center/directory.svg", imageAlt: "Illustrated group of people representing the member directory" }, ...features] : features).filter((feature) => feature.href !== "/account/membership/giving" || onlineGivingEnabled);
  return <main className="py-12 sm:py-16"><Container className="max-w-5xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Member center</p>
    <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Welcome to your member center</h1>
    <p className="mt-4 max-w-2xl text-lg leading-8 text-ink/60">Choose a member feature below. Your access follows the permissions and modules enabled by your church.</p>
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {availableFeatures.map((feature) => <Link key={feature.href} href={feature.href} className="focus-ring group">
        <Card className="relative min-h-72 overflow-hidden p-0 transition-transform duration-200 group-hover:-translate-y-1 group-hover:border-coral/40">
          <img src={feature.image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/10" />
          <div className="relative flex min-h-72 flex-col justify-between p-6 text-white"><div><p className="text-xl font-semibold">{feature.label}</p><p className="mt-3 text-sm leading-6 text-white/80">{feature.description}</p></div><span className="mt-6 text-sm font-semibold text-white">Open feature <span aria-hidden="true">→</span></span></div>
        </Card>
      </Link>)}
    </div>
  </Container></main>;
}
