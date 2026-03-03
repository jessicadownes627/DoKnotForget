type Props = {
  variant: "discover" | "nudge";
  message: string;
  onYes?: () => void;
  onNo?: () => void;
  onMaybe?: () => void;
  yesLabel?: string;
  noLabel?: string;
  maybeLabel?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
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
  actions,
}: Props) {
  const noop = () => {};
  const resolvedYesLabel = yesLabel ?? (variant === "discover" ? "Yes" : "Text");
  const resolvedNoLabel = noLabel ?? (variant === "discover" ? "No" : "Skip");
  const resolvedMaybeLabel = maybeLabel ?? (variant === "discover" ? "Not sure" : "Remind me Sunday");

  const resolvedActions =
    actions && actions.length
      ? actions
      : [
          { label: resolvedYesLabel, onClick: onYes ?? noop },
          ...(onMaybe ? [{ label: resolvedMaybeLabel, onClick: onMaybe }] : []),
          { label: resolvedNoLabel, onClick: onNo ?? noop },
        ];

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
        {resolvedActions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            style={{
              borderRadius: "12px",
              padding: "0.75rem 1rem",
              fontSize: "1rem",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
