import { requirePermission } from "@/lib/auth";
import { MediaLibrary } from "./media-library";

export default async function MediaPage() {
  await requirePermission("EDIT_PAGES");
  return <MediaLibrary />;
}
