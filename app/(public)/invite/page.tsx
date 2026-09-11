import { Container } from "@/components/ui";
import InviteForm from "./invite-form";

export default function InvitePage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <>
      <main>
        <Container className="py-16 text-center">
          <h1 className="font-serif text-4xl">Accept invitation</h1>
          {searchParams.token ? (
            <InviteForm token={searchParams.token} />
          ) : (
            <p className="mt-5 text-coral">This invitation link is missing its token.</p>
          )}
        </Container>
      </main>
    </>
  );
}
