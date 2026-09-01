import { Container } from "@/components/ui";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      {children}
      <footer className="border-t border-ink/10 py-8">
        <Container className="text-sm text-ink/60">St. Paul&apos;s · A place to belong</Container>
      </footer>
    </div>
  );
}
