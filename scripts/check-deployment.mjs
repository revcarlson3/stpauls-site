import fs from "node:fs";

function loadDotEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadDotEnv();

const errors = [];
const databaseUrl = process.env.DATABASE_URL ?? "";
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";

if (!databaseUrl) errors.push("DATABASE_URL is missing.");
else if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) errors.push("DATABASE_URL must use a PostgreSQL connection URL.");

if (!nextAuthUrl) errors.push("NEXTAUTH_URL is missing.");
else {
  try {
    const url = new URL(nextAuthUrl);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") errors.push("NEXTAUTH_URL must use HTTPS in production.");
  } catch {
    errors.push("NEXTAUTH_URL is not a valid URL.");
  }
}

if (!nextAuthSecret || nextAuthSecret.length < 32) errors.push("NEXTAUTH_SECRET must be at least 32 characters long.");
if (nextAuthSecret === "development-only-config-key") errors.push("NEXTAUTH_SECRET is still using the development fallback.");

if (errors.length) {
  console.error("Deployment configuration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Deployment configuration looks valid.");
