import type { CareSuggestion } from "../utils/careSuggestions";
import { useState } from "react";
import MomentDatePicker from "./MomentDatePicker";
import FeedCardShell from "./FeedCardShell";

type Props = {
  suggestion: CareSuggestion;
  onChoose: (optionId: string, data?: { text?: string; isoDate?: string }) => void;
  onDismiss: () => void;
};

function parseYmd(value: string) {
  const [yStr, mStr, dStr] = value.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

function toDraftFromIso(value: string) {
  const parts = parseYmd(value);
  if (!parts) return { monthDay: "", year: "" };
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return { monthDay: `2000-${mm}-${dd}`, year: parts.y > 0 ? String(parts.y) : "" };
}

function buildMomentIso(monthDay: string, year: string, requireYear: boolean) {
  if (!monthDay) return "";
  const parts = parseYmd(monthDay);
  if (!parts) return "";
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const y = year.trim();
  if (!y) return requireYear ? "" : `0000-${mm}-${dd}`;
  return `${y.padStart(4, "0")}-${mm}-${dd}`;
}

export default function MicroQuestionCard({ suggestion, onChoose, onDismiss }: Props) {
  const question = suggestion.question;
  if (!question) return null;

  const [childName, setChildName] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [draftMonthDay, setDraftMonthDay] = useState("");
  const [draftYear, setDraftYear] = useState("");

  return (
    <FeedCardShell>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1.15rem",
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.45,
            letterSpacing: "-0.01em",
          }}
        >
          {question.prompt}
        </div>
        <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.7 }}>
          {suggestion.message}
        </div>

        {question.options.length ? (
          <div style={{ marginTop: "16px", display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            {question.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onChoose(opt.id)}
                style={{
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--ink)",
                  cursor: "pointer",
                  textAlign: "center",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                  borderRadius: "8px",
                  padding: "0.75rem 1.05rem",
                  fontSize: "0.95rem",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : question.id === "addChildName" ? (
          <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Child name (optional)"
              style={{
                width: "100%",
                padding: "0.75rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                fontSize: "1rem",
                fontFamily: "var(--font-sans)",
              }}
            />
            <button
              onClick={() => onChoose("save", { text: childName })}
              style={{
                border: "1px solid var(--border-strong)",
                background: "transparent",
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: "center",
                fontWeight: 500,
                letterSpacing: "0.01em",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                fontSize: "0.95rem",
                boxShadow: "none",
                justifySelf: "start",
              }}
            >
              Save
            </button>
          </div>
        ) : question.id === "addChildBirthday" ? (
          <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
            <button
              onClick={() => {
                const draft = toDraftFromIso("");
                setDraftMonthDay(draft.monthDay);
                setDraftYear(draft.year);
                setIsDatePickerOpen(true);
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                width: "100%",
                padding: "0.85rem 0.95rem",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                cursor: "pointer",
                color: "var(--ink)",
                fontSize: "0.98rem",
                textAlign: "left",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span>Birthday</span>
              <span style={{ color: "var(--muted)" }}>Select date</span>
            </button>
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

        <button
          onClick={onDismiss}
          style={{
            marginTop: "14px",
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
          Not now
        </button>

      {question.id === "addChildBirthday" ? (
        <MomentDatePicker
          isOpen={isDatePickerOpen}
          title="Birthday"
          mode="birthday"
          monthDay={draftMonthDay}
          setMonthDay={setDraftMonthDay}
          year={draftYear}
          setYear={setDraftYear}
          yearHelperText="Optional."
          onSave={() => {
            const iso = buildMomentIso(draftMonthDay, draftYear, false);
            if (!iso) return;
            setIsDatePickerOpen(false);
            onChoose("save", { isoDate: iso });
          }}
          onCancel={() => setIsDatePickerOpen(false)}
          onClear={() => {
            setDraftMonthDay("");
            setDraftYear("");
          }}
        />
      ) : null}
    </FeedCardShell>
  );
}
