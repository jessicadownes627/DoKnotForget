import { useEffect } from "react";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import { useNavigate } from "../router";
import { useAppState } from "../appState";

export default function Onboarding() {
  const navigate = useNavigate();
  const { onboardingComplete, markOnboardingComplete } = useAppState();

  useEffect(() => {
    if (onboardingComplete) navigate("/home", { replace: true });
  }, [navigate, onboardingComplete]);

  return (
    <div style={{ background: "#0A1A3A", color: "var(--paper)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "env(safe-area-inset-top) 16px 16px 16px",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: "560px", margin: "0 auto", paddingTop: "24px" }}>
          <header>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "28px",
                fontWeight: 600,
                color: "var(--paper)",
                letterSpacing: "-0.03em",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <span className="dkf-fade-in-140" style={{ display: "inline-block" }}>
                <BowIcon size={28} />
              </span>
              <Brand />
            </h1>
            <div
              aria-hidden="true"
              style={{
                height: 0,
                borderBottom: "1px solid rgba(248, 247, 242, 0.18)",
                marginTop: "16px",
              }}
            />
          </header>

          <main style={{ marginTop: "28px" }}>
            <div
              className="dkf-fade-in-140"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "30px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.25,
                color: "var(--paper)",
              }}
            >
              Remember the moments that matter.
            </div>

            <div style={{ marginTop: "1.75rem" }}>
              <button
                className="dkf-fade-in-140"
                onClick={() => {
                  markOnboardingComplete();
                  navigate("/home");
                }}
                style={{
                  border: "1px solid rgba(248, 247, 242, 0.35)",
                  background: "transparent",
                  color: "var(--paper)",
                  cursor: "pointer",
                  textAlign: "center",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                  borderRadius: "12px",
                  padding: "0.95rem 1.15rem",
                  fontSize: "1rem",
                  boxShadow: "none",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Get started
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
