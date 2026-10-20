let publicSitePreviewWindow: Window | null = null;

const PAGE_SAVED_MESSAGE = "stpauls-site:page-saved";

export function openPublicSitePreview(url: string) {
  publicSitePreviewWindow = window.open(url, "_blank");
}

export function notifyPublicSitePreviewSaved() {
  try {
    if (publicSitePreviewWindow && !publicSitePreviewWindow.closed) {
      publicSitePreviewWindow.postMessage({ type: PAGE_SAVED_MESSAGE }, "*");
    }
  } catch {
    publicSitePreviewWindow = null;
  }
}

export function isPublicSitePageSavedMessage(value: unknown): value is { type: typeof PAGE_SAVED_MESSAGE } {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === PAGE_SAVED_MESSAGE);
}
