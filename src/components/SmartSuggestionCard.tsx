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
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
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
  // eslint-disable-next-line no-console
  console.log("SMART CARD PROPS:", {
    variant,
    message,
    onYes,
    onNo,
    onMaybe,
    yesLabel,
    noLabel,
    maybeLabel,
    actions,
  });

  if (false) {
    // eslint-disable-next-line no-console
    console.log("SMART CARD EXITING EARLY");
    return null;
  }
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
          a.href ? (
            <a
              key={a.label}
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={a.onClick}
              aria-disabled={a.disabled ? "true" : undefined}
              title={a.title}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-button)",
                border: "1px solid var(--border-strong)",
                padding: "0.85rem 1.15rem",
                fontSize: "1rem",
                fontWeight: 500,
                fontFamily: "inherit",
                backgroundColor: "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                boxShadow: "none",
                textDecoration: "none",
                opacity: a.disabled ? 0.5 : 1,
                pointerEvents: a.disabled ? "none" : undefined,
              }}
            >
              {a.label}
            </a>
          ) : (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick ?? noop}
              disabled={a.disabled}
              title={a.title}
              style={{
                borderRadius: "12px",
                padding: "0.75rem 1rem",
                fontSize: "1rem",
              }}
            >
              {a.label}
            </button>
          )
        ))}
      </div>
    </div>
  );
}
