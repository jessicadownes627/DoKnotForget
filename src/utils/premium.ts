export const PREMIUM_STORAGE_KEY = "doknotforget_premium";
export const PREMIUM_PRODUCT_ID = "com.doknotforget.premium";

export function loadPremiumStatus() {
  try {
    return window.localStorage.getItem(PREMIUM_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function savePremiumStatus(isPremium: boolean) {
  try {
    window.localStorage.setItem(PREMIUM_STORAGE_KEY, isPremium ? "true" : "false");
  } catch {
    // ignore
  }
}
