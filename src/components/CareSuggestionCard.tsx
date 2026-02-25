import { useMemo, useState } from "react";
import type { CareSuggestion } from "../utils/careSuggestions";
import FeedCardShell from "./FeedCardShell";

type Props = {
  suggestion: CareSuggestion;
  onAction: () => void;
  onSnooze?: () => void;
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toTimestampAtStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export default function CareSuggestionCard({ suggestion, onAction, onSnooze }: Props) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const extractedDate = (() => {
    const parts = suggestion.title.split(" · ").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return "";
    const last = parts[parts.length - 1] ?? "";
    return /[A-Za-z]{3,}\s+\d{1,2}/.test(last) ? last : "";
  })();

  const timelineLabel = useMemo(() => {
    if (!suggestion.timelineCategory) return null;
    const titleHasRelativeTime = /\b(yesterday|today|tomorrow|in\s+\d+\s+days)\b/i.test(suggestion.title);
    if (titleHasRelativeTime) return null;
    if (suggestion.timelineCategory === "soon") return "Soon";
    if (suggestion.timelineCategory === "upcoming") return "Upcoming";
    return "Later this season";
  }, [suggestion.timelineCategory, suggestion.title]);

  function setSnooze(nextAllowedTimestamp: number, kind: "snooze" | "hide") {
    try {
      window.localStorage.setItem(`doknotforget_snooze_${suggestion.id}`, String(nextAllowedTimestamp));
    } catch {
      // ignore
    }
    setIsMoreOpen(false);
    setIsExiting(true);

    window.setTimeout(() => {
      setFeedback(kind === "hide" ? "Okay — hidden for now." : "Got it — I’ll remind you later.");
      window.setTimeout(() => {
        onSnooze?.();
      }, 90);
    }, 120);
  }

  return (
    <FeedCardShell>
      <div className={isExiting ? "dkf-exit" : undefined}>
        {timelineLabel ? (
          <div style={{ color: "var(--muted)", fontSize: "0.82rem", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            {timelineLabel}
          </div>
        ) : null}

        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1.25rem",
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            marginTop: timelineLabel ? "6px" : 0,
          }}
        >
          {suggestion.title}
        </div>
        <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
          {suggestion.message}
        </div>

        {suggestion.cue ? (
          <div style={{ marginTop: "8px", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {suggestion.cue}
          </div>
        ) : null}

        {suggestion.insight ? (
          <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {suggestion.insight}
          </div>
        ) : null}

        {extractedDate ? (
          <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {extractedDate}
          </div>
        ) : null}

        <div
          aria-hidden="true"
          style={{
            height: 0,
            borderTop: "1px solid var(--border)",
            marginTop: "16px",
          }}
        />

        <div style={{ marginTop: "16px" }}>
          <button
            onClick={onAction}
            style={{
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--ink)",
              cursor: "pointer",
              textAlign: "center",
              fontWeight: 500,
              letterSpacing: "0.01em",
              borderRadius: "8px",
              padding: "0.8rem 1.05rem",
              fontSize: "0.95rem",
              boxShadow: "none",
            }}
          >
            {suggestion.actionLabel}
          </button>
        </div>

        {!isExiting ? (
          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsMoreOpen((v) => !v)}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                fontSize: "0.9rem",
              }}
            >
              More…
            </button>
          </div>
        ) : null}

        {isMoreOpen && !isExiting ? (
          <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                const t = startOfToday();
                t.setDate(t.getDate() + 1);
                setSnooze(toTimestampAtStartOfDay(t), "snooze");
              }}
              style={{ textAlign: "left" }}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                const t = startOfToday();
                const offset = Math.max(0, suggestion.sortDaysUntil);
                t.setDate(t.getDate() + offset);
                setSnooze(toTimestampAtStartOfDay(t), "snooze");
              }}
              style={{ textAlign: "left" }}
            >
              On the day
            </button>
            <button
              type="button"
              onClick={() => {
                const t = startOfToday();
                t.setDate(t.getDate() + 7);
                setSnooze(toTimestampAtStartOfDay(t), "snooze");
              }}
              style={{ textAlign: "left" }}
            >
              Next week
            </button>
            <button
              type="button"
              onClick={() => {
                const t = startOfToday();
                t.setDate(t.getDate() + 90);
                setSnooze(toTimestampAtStartOfDay(t), "hide");
              }}
              style={{ textAlign: "left" }}
            >
              Hide for now
            </button>
          </div>
        ) : null}

      </div>

      {feedback ? (
        <div className="dkf-fade-in-90" style={{ marginTop: "12px", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {feedback}
        </div>
      ) : null}
    </FeedCardShell>
  );
}
