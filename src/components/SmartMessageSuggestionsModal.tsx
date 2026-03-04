import { useEffect } from "react";

type Suggestion = {
  id: "quick" | "funny" | "thoughtful" | "custom";
  label: string;
  message: string;
};

type Props = {
  isOpen: boolean;
  personName: string;
  suggestions: Suggestion[];
  onPick: (message: string) => void;
  onClose: () => void;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 18, 24, 0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  padding: "12px",
  zIndex: 60,
};

const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

export default function SmartMessageSuggestionsModal({
  isOpen,
  personName,
  suggestions,
  onPick,
  onClose,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-label="Smart message suggestions">
      <div style={sheetStyle}>
        <div style={{ padding: "16px 16px 14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
              Smart message suggestions
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              Close
            </button>
          </div>
          <div style={{ marginTop: "6px", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            Choose a message for {personName}.
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />

        <div style={{ padding: "14px 16px 16px 16px", display: "grid", gap: "10px" }}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.message)}
              style={{
                border: "1px solid var(--border-strong)",
                background: "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 500,
                letterSpacing: "0.01em",
                borderRadius: "14px",
                padding: "12px 14px",
                fontSize: "0.98rem",
                lineHeight: 1.35,
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                {s.label}
              </div>
              <div>{s.message}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

