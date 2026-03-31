import { registerPlugin } from "@capacitor/core";

type StoreKitPlugin = {
  purchase(options: { productId: string }): Promise<{ success: boolean }>;
};

const StoreKit = registerPlugin<StoreKitPlugin>("StoreKit");

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