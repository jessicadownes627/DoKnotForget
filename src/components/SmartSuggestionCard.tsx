type Props = {
  variant: "discover" | "nudge";
  message: string;
  onYes: () => void;
  onNo: () => void;
  onMaybe?: () => void;
  yesLabel?: string;
  noLabel?: string;
  maybeLabel?: string;
};

export default function SmartSuggestionCard({
  variant,
  message,
  onYes,
  onNo,
  onMaybe,
  yesLabel,
  noLabel,
  maybeLabel,
}: Props) {
  const resolvedYesLabel = yesLabel ?? (variant === "discover" ? "Yes" : "Text");
  const resolvedNoLabel = noLabel ?? (variant === "discover" ? "No" : "Skip");
  const resolvedMaybeLabel = maybeLabel ?? (variant === "discover" ? "Not sure" : "Remind me Sunday");

  return (
    <div
      className="smart-card"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.7)",
        padding: "16px",
        display: "grid",
        gap: "12px",
        backdropFilter: "blur(6px)",
      }}
    >
      <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5, whiteSpace: "pre-line" }}>{message}</div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onYes}
          style={{
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            fontSize: "1rem",
          }}
        >
          {resolvedYesLabel}
        </button>
        {onMaybe ? (
          <button
            type="button"
            onClick={onMaybe}
            style={{
              borderRadius: "12px",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
            }}
          >
            {resolvedMaybeLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNo}
          style={{
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            fontSize: "1rem",
          }}
        >
          {resolvedNoLabel}
        </button>
      </div>
    </div>
  );
}
