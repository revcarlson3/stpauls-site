const dismissedAnnouncementPrefix = "announcement-dismissed:";

export function dismissAnnouncementForSession(id: string) {
  try {
    sessionStorage.setItem(`${dismissedAnnouncementPrefix}${id}`, "1");
  } catch {
    // Session storage can be unavailable in privacy-restricted browsers.
  }
}

export function isAnnouncementDismissedForSession(id: string) {
  try {
    return sessionStorage.getItem(`${dismissedAnnouncementPrefix}${id}`) === "1";
  } catch {
    return false;
  }
}

export function clearAnnouncementSession() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(dismissedAnnouncementPrefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // Session storage can be unavailable in privacy-restricted browsers.
  }
}
