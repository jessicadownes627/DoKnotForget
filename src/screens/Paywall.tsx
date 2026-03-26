import { useLocation, useNavigate } from "../router";

export default function Paywall() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPeopleLimitPaywall = location.state?.source === "people-limit";

  function continueFree() {
    const fallbackPath =
      typeof location.state?.fallbackPath === "string" && location.state.fallbackPath.trim()
        ? location.state.fallbackPath
        : "/home";

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    navigate(fallbackPath);
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

          <div
            style={{
              minHeight: "24px",
              color: "var(--muted)",
              fontSize: "0.92rem",
              lineHeight: 1.4,
            }}
          >
            Pricing will appear here.
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log("[DKF] Upgrade tapped");
              }}
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
              {isPeopleLimitPaywall ? "Not now" : "Continue free"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              // eslint-disable-next-line no-console
              console.log("[DKF] Restore purchases tapped");
            }}
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
