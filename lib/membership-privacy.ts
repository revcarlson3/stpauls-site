export type MembershipMessageChannel = "EMAIL" | "SMS";

type DirectoryMember = {
  directoryListed: boolean;
  family?: { directoryListed: boolean } | null;
};

type MessageMember = {
  status: string;
  email: string | null;
  cellphone: string | null;
  emailMessagesAllowed: boolean;
  smsMessagesAllowed: boolean;
  doNotContact?: boolean;
};

export function isListedInMemberDirectory(member: DirectoryMember) {
  return member.directoryListed && member.family?.directoryListed !== false;
}

export function membershipMessageEligibility(member: MessageMember, channel: MembershipMessageChannel) {
  if (member.status === "REMOVED") return { eligible: false, address: null, reason: "Member is archived" };
  if (member.doNotContact) return { eligible: false, address: null, reason: "Do not contact" };
  if (channel === "EMAIL") {
    if (!member.email) return { eligible: false, address: null, reason: "No email address" };
    if (!member.emailMessagesAllowed) return { eligible: false, address: null, reason: "Email messages not allowed" };
    return { eligible: true, address: member.email, reason: null };
  }
  if (!member.cellphone) return { eligible: false, address: null, reason: "No mobile phone" };
  if (!member.smsMessagesAllowed) return { eligible: false, address: null, reason: "SMS messages not allowed" };
  return { eligible: true, address: member.cellphone, reason: null };
}
