import crypto from "node:crypto";

const secret = () => process.env.NEXTAUTH_SECRET ?? "development-only-captcha-secret";

export function createCaptcha() {
  const left = crypto.randomInt(2, 10);
  const right = crypto.randomInt(2, 10);
  const answer = String(left + right);
  const payload = `${left}+${right}.${Date.now() + 10 * 60 * 1000}`;
  const signature = crypto.createHmac("sha256", secret()).update(`${payload}.${answer}`).digest("hex");
  return { question: `${left} + ${right} = ?`, token: `${payload}.${signature}` };
}

export function verifyCaptcha(token: unknown, answer: unknown) {
  if (typeof token !== "string" || typeof answer !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+\+\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return false;
  const [expression, expires, signature] = parts;
  if (Number(expires) < Date.now()) return false;
  const expectedAnswer = String(expression.split("+").reduce((sum, value) => sum + Number(value), 0));
  const expected = crypto.createHmac("sha256", secret()).update(`${expression}.${expires}.${expectedAnswer}`).digest("hex");
  return answer.trim() === expectedAnswer && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
