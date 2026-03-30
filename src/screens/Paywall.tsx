import { useEffect, useState } from "react";
import { useAppState } from "../appState";
import { useLocation, useNavigate } from "../router";
import { fetchPremiumProduct, purchaseProduct, restorePremiumPurchases, type StoreKitProduct } from "../utils/storeKit";

export default function Paywall() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium, setPremium } = useAppState();
  const isPeopleLimitPaywall = location.state?.source === "people-limit";
  const [isBusy, setIsBusy] = useState(false);
  const [premiumProduct, setPremiumProduct] = useState<StoreKitProduct | null>(null);

  useEffect(() => {
    if (!isPremium) return;
    navigate("/home", { replace: true });
  }, [isPremium, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const product = await fetchPremiumProduct();
        if (cancelled) return;
        if (!product) {
          setPremiumProduct(null);
          console.log("NO PRODUCTS");
          return;
        }
        setPremiumProduct(product);
        console.log("Selected product:", product);
      } catch (error) {
        if (cancelled) return;
        setPremiumProduct(null);
        console.error("[DKF] Failed to fetch products", error);
      }
    }

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, []);

  function continueFree() {
    navigate("/home", { state: { defaultTab: "home" } });
  }

  async function handleUpgrade() {
    console.log("Upgrade button tapped");
    if (isBusy) return;
    if (!premiumProduct) {
      console.error("No product available");
      console.log("NO PRODUCTS");
      return;
    }
    setIsBusy(true);
    try {
      console.log("Selected product before purchase:", premiumProduct);
      console.log("PURCHASE CALLED");
      console.log("Purchase triggered");
      const result = await purchaseProduct(premiumProduct.id);
      console.log("Purchase result:", result);
      if (result.status === "purchased") {
        setPremium(true);
        navigate("/home");
        return;
      }
      if (result.status === "cancelled") {
        console.log("[DKF] Purchase cancelled");
        return;
      }
      console.log("[DKF] Purchase pending");
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestorePurchases() {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const restored = await restorePremiumPurchases();
      if (restored) {
        setPremium(true);
        navigate("/home");
        return;
      }
      console.log("[DKF] No premium entitlement found to restore");
    } catch (error) {
      console.error("[DKF] Restore purchases failed", error);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          padding: "64px 16px 32px",
          boxSizing: "border-box",
          minHeight: "100vh",
          display: "grid",
          alignContent: "center",
        }}
      >
        <button
          type="button"
          onClick={continueFree}
          style={{
            justifySelf: "start",
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
          }}
        >
          Back
        </button>

        <div
          style={{
            marginTop: "28px",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.7)",
            padding: "28px 22px",
            display: "grid",
            gap: "18px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "30px",
                lineHeight: 1.1,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              {isPeopleLimitPaywall ? "Keep this going" : "Show up for everyone who matters"}
            </h1>
            <div style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.6 }}>
              {isPeopleLimitPaywall
                ? "We’ll help you stay on top of the people who matter — without having to think about it."
                : "Keep everything in one place. Never miss a moment."}
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px", color: "var(--ink)", fontSize: "0.98rem", lineHeight: 1.55 }}>
            {isPeopleLimitPaywall ? (
              <>
                <div>• Never miss important dates</div>
                <div>• Keep track of the people in your life</div>
                <div>• Stay one step ahead, quietly</div>
              </>
            ) : (
              <>
                <div>• Import your contacts in seconds</div>
                <div>• Keep track of everyone who matters</div>
                <div>• Always know the right moment to reach out</div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={isBusy}
              style={{
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                fontSize: "1rem",
              }}
            >
              {isPeopleLimitPaywall ? "Unlock your full list" : "Upgrade"}
            </button>
            <button
              type="button"
              onClick={continueFree}
              style={{
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                fontSize: "1rem",
                background: "transparent",
              }}
            >
              Not now
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleRestorePurchases()}
            disabled={isBusy}
            style={{
              justifySelf: "center",
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: "0.9rem",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Restore Purchases
          </button>
        </div>
      </div>
    </div>
  );
}
