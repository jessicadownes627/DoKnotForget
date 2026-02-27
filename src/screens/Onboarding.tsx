import { useMemo, useState } from "react";
import type { Person } from "../models/Person";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import PersonEditDrawer from "../components/PersonEditDrawer";

type Props = {
  onCreateFirstPerson: (person: Person) => void;
  onComplete: () => void;
  isExiting?: boolean;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Onboarding({ onCreateFirstPerson, onComplete, isExiting = false }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const draftPerson: Person = useMemo(
    () => ({
      id: makeId(),
      name: "",
      moments: [],
      children: [],
    }),
    []
  );

  const titleDelay = "0ms";
  const subtitleDelay = "140ms";
  const bowDelay = "280ms";
  const buttonDelay = "420ms";

  return (
    <div className={isExiting ? "dkf-exit" : undefined} style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "48px 1.5rem 72px" }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <header>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "2.65rem",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
                <span className="dkf-fade-in-140" style={{ display: "inline-block", animationDelay: bowDelay }}>
                  <BowIcon size={28} />
                </span>
                <Brand />
              </span>
            </h1>
            <div
              aria-hidden="true"
              style={{
                height: 0,
                borderBottom: "1px solid var(--border)",
                marginTop: "18px",
              }}
            />
          </header>

          <main style={{ marginTop: "34px" }}>
            {step === 1 ? (
              <>
                <div
                  className="dkf-fade-in-140"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.55rem",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.25,
                    animationDelay: titleDelay,
                  }}
                >
                  Show up for the people you care about.
                </div>
                <div className="dkf-fade-in-140" style={{ marginTop: "0.75rem", color: "var(--muted)", lineHeight: 1.7, animationDelay: subtitleDelay }}>
                  DKF lightens the mental load—so remembering never feels heavy.
                </div>

                <div style={{ marginTop: "2rem" }}>
                  <button
                    className="dkf-fade-in-140"
                    onClick={() => setStep(2)}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "8px",
                      padding: "1.25rem 1.1rem",
                      fontSize: "0.98rem",
                      boxShadow: "none",
                      fontFamily: "var(--font-sans)",
                      animationDelay: buttonDelay,
                    }}
                  >
                    Get started
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div
                  className="dkf-fade-in-140"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.45rem",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.25,
                    animationDelay: titleDelay,
                  }}
                >
                  Quiet reminders, right when you need them.
                </div>

                <div className="dkf-fade-in-140" style={{ marginTop: "0.75rem", color: "var(--muted)", lineHeight: 1.7, animationDelay: subtitleDelay }}>
                  Birthdays, milestones, little check-ins… handled softly, privately.
                </div>

                <div style={{ marginTop: "2.25rem", display: "flex", gap: "1rem", alignItems: "baseline" }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.95rem",
                    }}
                  >
                    Back
                  </button>
                  <button
                    className="dkf-fade-in-140"
                    onClick={() => setStep(3)}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "8px",
                      padding: "0.85rem 1.1rem",
                      fontSize: "0.98rem",
                      boxShadow: "none",
                      fontFamily: "var(--font-sans)",
                      animationDelay: buttonDelay,
                    }}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div
                  className="dkf-fade-in-140"
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.45rem",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.25,
                    animationDelay: titleDelay,
                  }}
                >
                  Keep your circle close.
                </div>
                <div className="dkf-fade-in-140" style={{ marginTop: "0.75rem", color: "var(--muted)", lineHeight: 1.7, animationDelay: subtitleDelay }}>
                  We help you notice the moments that matter.
                </div>

                <div style={{ marginTop: "2rem", display: "grid", gap: "0.85rem", justifyItems: "start" }}>
                  <button
                    className="dkf-fade-in-140"
                    onClick={() => setIsDrawerOpen(true)}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "8px",
                      padding: "0.85rem 1.1rem",
                      fontSize: "0.98rem",
                      boxShadow: "none",
                      fontFamily: "var(--font-sans)",
                      animationDelay: buttonDelay,
                    }}
                  >
                    Add person
                  </button>

                  <button
                    onClick={onComplete}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.95rem",
                    }}
                  >
                    Skip for now
                  </button>
                </div>
              </>
            ) : null}
          </main>
        </div>
      </div>

      <PersonEditDrawer
        isOpen={isDrawerOpen}
        person={draftPerson}
        onClose={() => setIsDrawerOpen(false)}
        onSave={(p) => {
          onCreateFirstPerson(p);
          onComplete();
        }}
      />
    </div>
  );
}
