import { Container } from "@/components/ui";
import { MenuEditor } from "@/components/menu-editor";

export default function EditMenuPage({ params }: { params: { id: string } }) {
  return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Site structure</p><h1 className="mt-2 font-serif text-4xl">Edit menu</h1><div className="mt-8"><MenuEditor id={params.id} /></div></Container></main>;
}
