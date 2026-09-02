import { NextResponse } from "next/server";
import { getOwnAccount, updateOwnAccount } from "@/lib/users";
import { requestEmailChange } from "@/lib/email-change";

export async function GET() {
  try { return NextResponse.json(await getOwnAccount()); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 }); return NextResponse.json({ error: "Unable to load account." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const input = await request.json();
  if (!input || typeof input.name !== "string" || (input.email !== undefined && typeof input.email !== "string") || (input.currentPassword !== undefined && typeof input.currentPassword !== "string") || (input.newPassword !== undefined && typeof input.newPassword !== "string")) return NextResponse.json({ error: "Invalid account details." }, { status: 400 });
  try {
    if (input.email) {
      await requestEmailChange(input.email);
      const account = await updateOwnAccount(input);
      return NextResponse.json({ ...account, message: "Confirmation sent to your new email address. Your current email remains active until confirmed." });
    }
    return NextResponse.json(await updateOwnAccount(input));
  }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    if (error instanceof Error && ["Name must", "Current password", "New password", "Provide", "That email", "Email delivery"].some((prefix) => error.message.startsWith(prefix))) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to update account." }, { status: 500 });
  }
}
