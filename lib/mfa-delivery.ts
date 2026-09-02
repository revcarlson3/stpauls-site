import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getMailSettings, getSmsSettings } from "@/lib/app-config";

export async function sendEmailMfaCode(recipient: string, code: string) {
  const mail = await getMailSettings();
  if (!mail.smtpHost || !mail.smtpUser || !mail.smtpPassword || !mail.emailFrom) {
    throw new Error("Email delivery is not configured. Ask an administrator to configure SMTP.");
  }
  const transporter = nodemailer.createTransport({
    host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpPort === 465,
    auth: { user: mail.smtpUser, pass: mail.smtpPassword }
  });
  await transporter.sendMail({
    from: mail.emailFrom, to: recipient, subject: "Your St. Paul's verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this message.`
  });
}

export async function sendSmsMfaCode(recipient: string, code: string) {
  const sms = await getSmsSettings();
  if (!sms.accountId || !sms.authSecret || !sms.from) {
    throw new Error("Text-message delivery is not configured. Ask an administrator to configure an SMS provider.");
  }
  const text = `Your St. Paul's verification code is ${code}. It expires in 10 minutes.`;
  if (sms.provider === "twilio") {
    const auth = Buffer.from(`${sms.accountId}:${sms.authSecret}`).toString("base64");
    await request("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sms.accountId) + "/Messages.json", {
      method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: recipient, From: sms.from, Body: text }).toString()
    });
    return;
  }
  if (sms.provider === "vonage") {
    await request("https://rest.nexmo.com/sms/json", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: sms.accountId, api_secret: sms.authSecret, to: recipient, from: sms.from, text }).toString()
    });
    return;
  }
  await sendAwsSns(recipient, text, sms.accountId, sms.authSecret);
}

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("The configured message provider rejected the request.");
  const body = await response.json().catch(() => ({})) as { messages?: Array<{ status?: string }> };
  if (body.messages?.some((message) => message.status && message.status !== "0")) {
    throw new Error("The configured message provider rejected the request.");
  }
}

async function sendAwsSns(phone: string, message: string, accessKey: string, secret: string) {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const host = `sns.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const body = new URLSearchParams({ Action: "Publish", PhoneNumber: phone, Message: message, Version: "2010-03-31" }).toString();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded; charset=utf-8", host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash };
  const canonicalHeaders = `content-type:${headers["content-type"]}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${region}/sns/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;
  const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${secret}`), date), region), "sns"), "aws4_request");
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(signingKey, stringToSign).toString("hex")}`;
  await request(endpoint, { method: "POST", headers, body });
}

function hmac(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}
