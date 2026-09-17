export function canSendToUser(input: { senderIsAdmin: boolean; senderGroupId: string | null; recipientGroupId: string | null; recipientIsAdmin: boolean }) {
  return input.senderIsAdmin || input.senderGroupId === input.recipientGroupId || input.recipientIsAdmin;
}

export function canSendToGroup(input: { senderIsAdmin: boolean; senderGroupId: string | null; targetGroupId: string }) {
  return input.senderIsAdmin || input.senderGroupId === input.targetGroupId;
}

export const MAX_NOTIFICATION_RECIPIENTS = 500;
