export const DEFAULT_PLATFORM_DOMAIN = "mychurch.one";

export function normalizeRequestHost(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(",")[0].split(":")[0].replace(/\.+$/, "");
}

export function isPlatformHost(hostValue: string | null | undefined, env: NodeJS.ProcessEnv = process.env) {
  const host = normalizeRequestHost(hostValue);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const configured = [env.PLATFORM_BASE_HOST, env.PLATFORM_DOMAIN_SUFFIX, ...(env.PLATFORM_HOST_ALIASES ?? "").split(",")]
    .map(normalizeRequestHost)
    .filter(Boolean);
  const baseHosts = configured.length ? configured : [DEFAULT_PLATFORM_DOMAIN];
  const betaHosts = baseHosts.flatMap((base) => [`beta.${base}`]);
  return baseHosts.includes(host) || betaHosts.includes(host) || baseHosts.some((base) => host === `www.${base}`);
}

export function isTenantHost(hostValue: string | null | undefined, env: NodeJS.ProcessEnv = process.env) {
  const host = normalizeRequestHost(hostValue);
  return Boolean(host) && !isPlatformHost(host, env);
}
