import { Container } from "@/components/ui";
import EditorCanvas from "../../editor/editor-canvas";
export default function AddPage() { return <main><Container className="py-10 sm:py-14"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">New page</p><h1 className="mt-2 font-serif text-4xl">Add a Page</h1><div className="mt-8"><EditorCanvas empty /></div></Container></main>; }
