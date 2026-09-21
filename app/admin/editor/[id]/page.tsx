import { Container } from "@/components/ui";
import EditorCanvas from "../editor-canvas";

export default function EditPage({ params }: { params: { id: string } }) {
  return <main className="h-full overflow-hidden"><Container className="h-full min-h-0 py-6 sm:py-8"><EditorCanvas pageId={params.id} /></Container></main>;
}
