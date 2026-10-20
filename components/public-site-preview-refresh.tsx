"use client";

import { useEffect } from "react";
import { isPublicSitePageSavedMessage } from "@/lib/public-site-preview";

export function PublicSitePreviewRefresh() {
  useEffect(() => {
    const refreshAfterSave = (event: MessageEvent) => {
      if (event.source !== window.opener || !isPublicSitePageSavedMessage(event.data)) return;
      window.location.reload();
    };
    window.addEventListener("message", refreshAfterSave);
    return () => window.removeEventListener("message", refreshAfterSave);
  }, []);

  return null;
}
