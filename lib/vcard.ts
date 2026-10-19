type VCardContact = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

function escapeVCardValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

export function buildVCard(contact: VCardContact) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(contact.lastName)};${escapeVCardValue(contact.firstName)};;;`,
    `FN:${escapeVCardValue(`${contact.firstName} ${contact.lastName}`.trim())}`
  ];
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(contact.email)}`);
  if (contact.phone) lines.push(`TEL;TYPE=VOICE:${escapeVCardValue(contact.phone)}`);
  if (contact.address) lines.push(`ADR;TYPE=HOME:;;${escapeVCardValue(contact.address)};;;;`);
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}
