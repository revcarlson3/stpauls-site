import { Container } from "@/components/ui";
import EditorCanvas from "../editor-canvas";

export default function EditPage({ params }: { params: { id: string } }) {
  return <main><Container className="py-10 sm:py-14"><EditorCanvas pageId={params.id} /></Container></main>;
}
