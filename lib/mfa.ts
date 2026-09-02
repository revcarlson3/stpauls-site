import crypto from "node:crypto";
import { decryptConfig, encryptConfig } from "@/lib/app-config";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function createOtpAuthUri(secret: string, account: string, issuer: string) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / 30);
  return [-1, 0, 1].some((offset) => timingSafeEqual(generateTotp(secret, counter + offset), normalized));
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${bytes.slice(0, 5)}-${bytes.slice(5)}`;
  });
}

export function encryptRecoveryCodes(codes: string[]) {
  return encryptConfig(JSON.stringify(codes.map(hashRecoveryCode)));
}

export function consumeRecoveryCode(encrypted: string | null, code: string) {
  if (!encrypted) return { valid: false, remaining: encrypted };
  let hashes: string[];
  try {
    hashes = JSON.parse(decryptConfig(encrypted)) as string[];
  } catch {
    return { valid: false, remaining: encrypted };
  }
  const hash = hashRecoveryCode(code);
  const index = hashes.findIndex((candidate) => timingSafeEqual(candidate, hash));
  if (index < 0) return { valid: false, remaining: encrypted };
  hashes.splice(index, 1);
  return { valid: true, remaining: encryptRecoveryCodesFromHashes(hashes) };
}

export function hashRecoveryCode(code: string) {
  return crypto.createHash("sha256").update(code.replace(/\s/g, "").toUpperCase()).digest("hex");
}

function encodeBase32(value: Buffer) {
  let bits = 0;
  let bitCount = 0;
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const byte = value[index];
    bits = (bits << 8) | byte;
    bitCount += 8;
    while (bitCount >= 5) {
      output += BASE32_ALPHABET[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }
  if (bitCount > 0) output += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  return output;
}

function decodeBase32(value: string) {
  let bits = 0;
  let bitCount = 0;
  const output: number[] = [];
  for (const character of value.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    bits = (bits << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      output.push((bits >>> (bitCount - 8)) & 255);
      bitCount -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTotp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encryptRecoveryCodesFromHashes(hashes: string[]) {
  return encryptConfig(JSON.stringify(hashes));
}
