import { redirect } from "next/navigation";

export default async function MembershipAttendancePage() {
  redirect("/admin/events/attendance");
}
