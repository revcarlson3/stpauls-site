export function isAllowedFaviconUrl(value: string, churchId: string) {
  if (!value) return true;
  if (value.startsWith("/uploads/site-identity/")) {
    return value.startsWith(`/uploads/site-identity/${churchId}/`);
  }
  if (!value.startsWith("/api/media/upload?")) return false;

  try {
    const url = new URL(value, "http://localhost");
    const parameterNames = Array.from(url.searchParams.keys());
    const file = url.searchParams.get("file");
    const tenant = url.searchParams.get("tenant");
    return url.pathname === "/api/media/upload"
      && parameterNames.every((name) => name === "file" || name === "tenant")
      && url.searchParams.getAll("file").length === 1
      && Boolean(file)
      && (!tenant || tenant === churchId);
  } catch {
    return false;
  }
}
