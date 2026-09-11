import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getMailSettings } from "@/lib/app-config";
import { sendSmsText } from "@/lib/mfa-delivery";

export type EmailAttachment = {
  fileName: string;
  contentBase64: string;
  contentType?: string;
};

type EmailInput = {
  recipient: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachments: EmailAttachment[];
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
};

function addressWithName(name: string | undefined, email: string) {
  const cleanName = name?.replace(/["\r\n]/g, "").trim();
  return cleanName ? `"${cleanName}" <${email}>` : email;
}

function safeAttachmentName(name: string) {
  return name.replace(/[\\/"\r\n]/g, "_").slice(0, 200) || "attachment";
}

function addresses(value: string[] | undefined) {
  return value?.filter(Boolean);
}

function attachmentContent(attachment: EmailAttachment) {
  const separator = attachment.contentBase64.indexOf(",");
  return separator >= 0 ? attachment.contentBase64.slice(separator + 1) : attachment.contentBase64;
}

async function providerDetail(response: Response) {
  const detail = await response.text();
  return detail ? `: ${detail.slice(0, 300)}` : ".";
}

export async function sendMembershipEmail(input: EmailInput) {
  const mail = await getMailSettings();
  if (!mail.emailFrom) {
    throw new Error("Email delivery is not configured. Ask an administrator to configure a From address.");
  }
  const fromEmail = input.fromEmail || mail.emailFrom;
  const fromName = input.fromName?.replace(/["\r\n]/g, "").trim();
  const from = addressWithName(fromName, fromEmail);
  const cc = addresses(input.cc);
  const bcc = addresses(input.bcc);
  if (mail.provider === "sendgrid") {
    if (!mail.apiKey) throw new Error("SendGrid email delivery is not configured. Ask an administrator to configure the API key.");
    const attachments = input.attachments.map((attachment) => ({
      content: attachmentContent(attachment),
      filename: safeAttachmentName(attachment.fileName),
      type: attachment.contentType || "application/octet-stream",
      disposition: "attachment"
    }));
    const personalization = {
      to: [{ email: input.recipient }],
      ...(cc?.length ? { cc: cc.map((email) => ({ email })) } : {}),
      ...(bcc?.length ? { bcc: bcc.map((email) => ({ email })) } : {})
    };
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${mail.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [personalization],
        from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
        ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.bodyText },
          { type: "text/html", value: input.bodyHtml }
        ],
        ...(attachments.length > 0 ? { attachments } : {})
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`SendGrid rejected the email${await providerDetail(response)}`);
    return;
  }
  if (mail.provider === "mailgun") {
    if (!mail.apiKey || !mail.apiDomain) throw new Error("Mailgun email delivery is not configured. Ask an administrator to configure the API key and domain.");
    const form = new FormData();
    form.set("from", from);
    form.set("to", input.recipient);
    form.set("subject", input.subject);
    form.set("text", input.bodyText);
    form.set("html", input.bodyHtml);
    if (input.replyTo) form.set("h:Reply-To", input.replyTo);
    if (cc?.length) form.set("cc", cc.join(","));
    if (bcc?.length) form.set("bcc", bcc.join(","));
    for (const attachment of input.attachments) {
      form.append("attachment", new Blob([Buffer.from(attachmentContent(attachment), "base64")], { type: attachment.contentType || "application/octet-stream" }), safeAttachmentName(attachment.fileName));
    }
    const response = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(mail.apiDomain)}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${mail.apiKey}`).toString("base64")}` },
      body: form,
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Mailgun rejected the email${await providerDetail(response)}`);
    return;
  }
  if (mail.provider === "postmark") {
    if (!mail.apiKey) throw new Error("Postmark email delivery is not configured. Ask an administrator to configure the server token.");
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { "X-Postmark-Server-Token": mail.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        From: from,
        To: input.recipient,
        ...(input.replyTo ? { ReplyTo: input.replyTo } : {}),
        ...(cc?.length ? { Cc: cc.join(",") } : {}),
        ...(bcc?.length ? { Bcc: bcc.join(",") } : {}),
        Subject: input.subject,
        TextBody: input.bodyText,
        HtmlBody: input.bodyHtml,
        Attachments: input.attachments.map((attachment) => ({
          Name: safeAttachmentName(attachment.fileName),
          Content: attachmentContent(attachment),
          ContentType: attachment.contentType || "application/octet-stream"
        }))
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Postmark rejected the email${await providerDetail(response)}`);
    return;
  }
  if (mail.provider === "resend") {
    if (!mail.apiKey) throw new Error("Resend email delivery is not configured. Ask an administrator to configure the API key.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${mail.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(cc?.length ? { cc } : {}),
        ...(bcc?.length ? { bcc } : {}),
        subject: input.subject,
        text: input.bodyText,
        html: input.bodyHtml,
        ...(input.attachments.length ? {
          attachments: input.attachments.map((attachment) => ({
            filename: safeAttachmentName(attachment.fileName),
            content: attachmentContent(attachment)
          }))
        } : {})
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Resend rejected the email${await providerDetail(response)}`);
    return;
  }
  if (mail.provider === "amazon-ses") {
    if (!mail.apiKey || !mail.apiSecret || !mail.apiRegion) throw new Error("Amazon SES email delivery is not configured. Ask an administrator to configure the access key, secret, and region.");
    await sendAmazonSes(mail.apiKey, mail.apiSecret, mail.apiRegion, from, input);
    return;
  }
  if (mail.provider !== "smtp") throw new Error(`${mail.provider} email delivery is not supported.`);
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword) {
    throw new Error("SMTP email delivery is not configured. Ask an administrator to configure SMTP.");
  }
  const transporter = nodemailer.createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    secure: mail.smtpPort === 465,
    auth: { user: mail.smtpUser, pass: mail.smtpPassword }
  });
  await transporter.sendMail({
    from,
    to: input.recipient,
    ...(cc?.length ? { cc } : {}),
    ...(bcc?.length ? { bcc } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    subject: input.subject,
    html: input.bodyHtml,
    text: input.bodyText,
    attachments: input.attachments.map((attachment) => ({
      filename: safeAttachmentName(attachment.fileName),
      content: attachmentContent(attachment),
      encoding: "base64",
      contentType: attachment.contentType || "application/octet-stream"
    }))
  });
}

async function sendAmazonSes(accessKey: string, secret: string, region: string, from: string, input: EmailInput) {
  const boundary = `stpauls-${crypto.randomBytes(12).toString("hex")}`;
  const headers = [
    `From: ${from}`,
    `To: ${input.recipient}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(", ")}`] : []),
    ...(input.bcc?.length ? [`Bcc: ${input.bcc.join(", ")}`] : []),
    ...(input.replyTo ? [`Reply-To: ${input.replyTo}`] : []),
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ];
  const parts = [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: multipart/alternative; boundary=\"alt\"",
    "",
    "--alt",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.bodyText,
    "--alt",
    "Content-Type: text/html; charset=UTF-8",
    "",
    input.bodyHtml,
    "--alt--"
  ];
  for (const attachment of input.attachments) {
    const safeName = safeAttachmentName(attachment.fileName);
    parts.push(`--${boundary}`, `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${safeName}"`, `Content-Disposition: attachment; filename="${safeName}"`, "Content-Transfer-Encoding: base64", "", attachmentContent(attachment));
  }
  parts.push(`--${boundary}--`);
  const body = JSON.stringify({ FromEmailAddress: from, Destination: { ToAddresses: [input.recipient], CcAddresses: input.cc ?? [], BccAddresses: input.bcc ?? [] }, Content: { Raw: { Data: Buffer.from(parts.join("\r\n")).toString("base64") } } });
  const host = `email.${region}.amazonaws.com`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const headersToSign = { "content-type": "application/x-amz-json-1.0", host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash };
  const canonicalHeaders = `content-type:${headersToSign["content-type"]}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = `POST\n/v2/email/outbound-emails\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${region}/ses/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;
  const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${secret}`), date), region), "ses"), "aws4_request");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(signingKey, stringToSign).toString("hex")}`;
  const response = await fetch(`https://${host}/v2/email/outbound-emails`, { method: "POST", headers: { ...headersToSign, Authorization: authorization }, body, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Amazon SES rejected the email${await providerDetail(response)}`);
}

function hmac(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

export { sendSmsText };
