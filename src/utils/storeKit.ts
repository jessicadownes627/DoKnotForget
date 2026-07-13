import { Capacitor, registerPlugin } from "@capacitor/core";
import { PREMIUM_PRODUCT_ID } from "./premium";

type StoreKitPlugin = {
  purchase(options: { productId: string }): Promise<{ success: boolean }>;
  restorePurchases(): Promise<{ success: boolean }>;
  getEntitlementStatus(options: { productId: string }): Promise<{ active: boolean }>;
};

const StoreKit = registerPlugin<StoreKitPlugin>("StoreKit");

function isNativeStoreKitAvailable() {
  return Capacitor.getPlatform() !== "web";
}

// 🔥 Purchase (this is all we need right now)
export async function purchaseProduct(productId: string) {
  try {
    console.log("🚀 Starting purchase for:", productId);

    const result = await StoreKit.purchase({ productId });

    console.log("✅ Purchase result:", result);

    return result?.success === true;
  } catch (error) {
    console.error("❌ Purchase failed:", error);
    throw error;
  }
}

export async function restorePremiumPurchases() {
  try {
    const result = await StoreKit.restorePurchases();
    return result?.success === true;
  } catch (error) {
    console.error("❌ Restore failed:", error);
    return false;
  }
}

export async function getPremiumEntitlementStatus() {
  if (!isNativeStoreKitAvailable()) return null;

  try {
    const result = await StoreKit.getEntitlementStatus({ productId: PREMIUM_PRODUCT_ID });
    return result?.active === true;
  } catch (error) {
    console.error("❌ Entitlement check failed:", error);
    return null;
  }
}
