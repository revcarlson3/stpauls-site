import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const siteFile = path.join(root, "lib", "site.ts");
const source = fs.readFileSync(siteFile, "utf8");
const revisionPattern = /(SITE_REVISION\s*=\s*")(\d+)\.(\d+)\.(\d+)\.(\d+)(")/;
const match = source.match(revisionPattern);

if (!match) {
  throw new Error("SITE_REVISION must use the format major.minor.patch.build.");
}

const nextBuild = Number(match[5]) + 1;
const nextSource = source.replace(revisionPattern, `$1${match[2]}.${match[3]}.${match[4]}.${nextBuild}$6`);
fs.writeFileSync(siteFile, nextSource);
console.log(`Site revision: ${match[2]}.${match[3]}.${match[4]}.${nextBuild}`);
