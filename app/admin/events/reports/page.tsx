import { Container } from "@/components/ui";
import { EventReportManager } from "./report-manager";
import dynamic from "next/dynamic";

const EventReportResults = dynamic(() => import("./report-results").then((module) => module.EventReportResults), { ssr: false });

export default function EventReportsPage() {
  return <main><Container className="py-10 sm:py-14">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Events and scheduling</p>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="mt-2 font-serif text-4xl">Reports</h1><p className="mt-3 max-w-2xl text-ink/60">Review events, attendance, absentees, and volunteer assignments.</p></div>
      <a href="/admin/events" className="focus-ring rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral">Back to events</a>
    </div>
    <EventReportManager /><EventReportResults />
  </Container></main>;
}
