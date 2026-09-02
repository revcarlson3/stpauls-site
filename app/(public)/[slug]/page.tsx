import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublishedPageShell } from "@/components/page-renderer";

export const dynamic = "force-dynamic";

export default async function PublishedPage({ params }: { params: { slug: string } }) {
  const page = await db.page.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    select: { title: true, blocks: true }
  });

  if (!page) notFound();
  return <PublishedPageShell title={page.title} blocks={page.blocks} />;
}

