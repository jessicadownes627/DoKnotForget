import { useEffect, useState } from "react";
import { useAppState } from "../appState";
import { useLocation, useNavigate } from "../router";
import { purchaseProduct, restorePremiumPurchases } from "../utils/storeKit";

export default function Paywall() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium, setPremium } = useAppState();
  const isPeopleLimitPaywall = location.state?.source === "people-limit";
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isPremium) return;

    const timeoutId = window.setTimeout(() => {
      navigate("/");
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isPremium, navigate]);

  function continueFree() {
    navigate("/home", { state: { defaultTab: "home" } });
  }

  async function handleUpgrade() {
    if (isBusy) return;

    try {
      setIsBusy(true);

      const success = await purchaseProduct("com.doknotforget.premium");

      if (success) {
        setPremium(true);
        alert("You're premium 🎉");
      }
    } catch (e) {
      console.error(e);
      alert("Purchase failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestorePurchases() {
    if (isBusy) return;

    try {
      setIsBusy(true);

      const restored = await restorePremiumPurchases();

      if (restored) {
        setPremium(true);
        alert("Restored 🎉");
        return;
      }

      alert("No purchases found");
    } catch (e) {
      console.error(e);
      alert("No purchases found");
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
              onClick={handleUpgrade}
              disabled={isBusy}
              style={{
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                fontSize: "1rem",
              }}
            >
              {isBusy ? "Processing..." : isPeopleLimitPaywall ? "Unlock your full list" : "Upgrade"}
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
            <button
              type="button"
              onClick={handleRestorePurchases}
              disabled={isBusy}
              style={{
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                fontSize: "1rem",
                background: "transparent",
              }}
            >
              Restore Purchases
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
