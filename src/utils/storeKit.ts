import { registerPlugin } from "@capacitor/core";
import { PREMIUM_PRODUCT_ID } from "./premium";

export type StoreKitProduct = {
  id: string;
  title: string;
  description: string;
  displayPrice: string;
};

type GetProductsResult = {
  products: StoreKitProduct[];
};

type PurchaseResult = {
  status: "purchased" | "cancelled" | "pending";
  productId?: string;
};

type RestoreResult = {
  productIds: string[];
};

type StoreKit = {
  getProducts(options: { productIds: string[] }): Promise<GetProductsResult>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
};

const StoreKit = registerPlugin<StoreKit>("StoreKit");
export default StoreKit;

export async function fetchPremiumProduct() {
  console.log("Fetching products...");
  const result = await StoreKit.getProducts({ productIds: [PREMIUM_PRODUCT_ID] });
  console.log("Products loaded:", result.products);
  if ((result.products ?? []).length === 0) {
    console.log("NO PRODUCTS RETURNED");
  }
  return result.products.find((product) => product.id === PREMIUM_PRODUCT_ID) ?? null;
}

export async function purchaseProduct(productId: string) {
  console.log("Attempting purchase...");
  return StoreKit.purchase({ productId });
}

export async function restorePremiumPurchases() {
  const result = await StoreKit.restorePurchases();
  return result.productIds.includes(PREMIUM_PRODUCT_ID);
}
