import { NextResponse } from "next/server";
import { resendInvitation, revokeInvitation } from "@/lib/invitations";

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Permission required." }, { status: 403 });
  if (error instanceof Error && (error.message.startsWith("Invitation") || error.message.startsWith("Email delivery"))) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ error: "Unable to update this invitation." }, { status: 500 });
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await resendInvitation(params.id);
    return NextResponse.json({ message: "Invitation resent." });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await revokeInvitation(params.id);
    return NextResponse.json({ message: "Invitation revoked." });
  } catch (error) {
    return errorResponse(error);
  }
}
