import { useMemo, useState } from "react";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type PickerMode = "birthday" | "anniversary" | "custom";

type MonthDayParts = { month: number; day: number } | null;

function parseMonthDay(value: string): MonthDayParts {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day || Number.isNaN(month) || Number.isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  return { month, day };
}

function daysInMonth(month: number) {
  return new Date(2000, month, 0).getDate();
}

type Props = {
  isOpen: boolean;
  title: string;
  mode: PickerMode;
  monthDay: string;
  setMonthDay: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  yearHelperText: string;
  requireYear?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void;
};

export default function MomentDatePicker({
  isOpen,
  title,
  mode,
  monthDay,
  setMonthDay,
  year,
  setYear,
  yearHelperText,
  requireYear = false,
  onSave,
  onCancel,
  onClear,
}: Props) {
  const [activePicker, setActivePicker] = useState<"month" | "day" | null>(null);

  const parts = useMemo(() => parseMonthDay(monthDay), [monthDay]);
  const monthLabel = parts ? MONTH_LABELS[parts.month - 1] : "Month";
  const dayLabel = parts ? String(parts.day) : "Day";
  const currentDaysInMonth = parts?.month ? daysInMonth(parts.month) : 31;

  const yearNumber = Number(year);
  const previewValue =
    year.trim() && !Number.isNaN(yearNumber) && yearNumber > 0
      ? new Date().getFullYear() - yearNumber
      : null;

  const previewText = useMemo(() => {
    if (!year.trim() || previewValue === null || previewValue <= 0) return null;
    if (mode === "birthday") return `Turning ${previewValue} this year`;
    if (mode === "anniversary") return `${previewValue} years this year`;
    return null;
  }, [mode, previewValue, year]);

  const canSave = Boolean(monthDay) && (!requireYear || Boolean(year.trim()));
  const showClear = Boolean(monthDay || year.trim());

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} picker`}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.18)",
        display: "grid",
        placeItems: "center",
        padding: "1.25rem",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modalContent"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--card)",
          borderRadius: "16px",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--ink)" }}>{title}</div>

        <div style={{ marginTop: "1.2rem", display: "flex", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setActivePicker((v) => (v === "month" ? null : "month"))}
            style={{
              flex: 1,
              border: "1px solid var(--border-strong)",
              background: "var(--card)",
              color: "var(--ink)",
              borderRadius: "999px",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
          >
            {monthLabel}
          </button>
          <button
            type="button"
            onClick={() => setActivePicker((v) => (v === "day" ? null : "day"))}
            style={{
              flex: 1,
              border: "1px solid var(--border-strong)",
              background: "var(--card)",
              color: "var(--ink)",
              borderRadius: "999px",
              padding: "0.85rem 1rem",
              fontSize: "1rem",
              cursor: parts?.month ? "pointer" : "default",
              textAlign: "left",
              fontWeight: 500,
              opacity: parts?.month ? 1 : 0.55,
            }}
            disabled={!parts?.month}
          >
            {dayLabel}
          </button>
        </div>

        {activePicker ? (
          <div
            style={{
              marginTop: "1rem",
              padding: "1.05rem",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              background: "var(--paper)",
            }}
          >
            {activePicker === "month" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem" }}>
                {MONTH_LABELS.map((label, idx) => {
                  const m = idx + 1;
                  const isActive = parts?.month === m;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const maxDays = daysInMonth(m);
                        const dRaw = parts?.day && parts.day > 0 ? parts.day : 1;
                        const d = Math.min(dRaw, maxDays);
                        const mm = String(m).padStart(2, "0");
                        const dd = String(d).padStart(2, "0");
                        setMonthDay(`2000-${mm}-${dd}`);
                        setActivePicker(null);
                      }}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid var(--border)",
                        background: isActive ? "rgba(0,0,0,0.03)" : "transparent",
                        color: "var(--ink)",
                        padding: "0.6rem 0.7rem",
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        textAlign: "center",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0.5rem" }}>
                {Array.from({ length: currentDaysInMonth }, (_, i) => i + 1).map((d) => {
                  const isActive = parts?.day === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const m = parts?.month ?? 1;
                        const mm = String(m).padStart(2, "0");
                        const dd = String(d).padStart(2, "0");
                        setMonthDay(`2000-${mm}-${dd}`);
                        setActivePicker(null);
                      }}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid var(--border)",
                        background: isActive ? "rgba(0,0,0,0.03)" : "transparent",
                        color: "var(--ink)",
                        padding: "0.5rem 0",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        textAlign: "center",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: "1.35rem" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 600 }}>Year</div>
          <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.5 }}>
            {yearHelperText}
          </div>

          <input
            type="number"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder=""
            className="yearInput"
            style={{
              marginTop: "0.75rem",
              padding: "0.9rem 1rem",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "1px solid var(--border-strong)",
              background: "var(--card)",
              color: "var(--ink)",
            }}
          />

          {previewText ? (
            <div style={{ marginTop: "0.55rem", color: "var(--ink)", fontSize: "0.95rem" }}>
              {previewText}
            </div>
          ) : null}

          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              style={{
                marginTop: "0.85rem",
                padding: 0,
                border: "none",
                background: "none",
                color: "var(--muted)",
                fontSize: "0.9rem",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: "1.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            style={{
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--ink)",
              cursor: canSave ? "pointer" : "default",
              textAlign: "center",
              fontWeight: 500,
              letterSpacing: "0.01em",
              borderRadius: "8px",
              padding: "0.85rem 1.15rem",
              fontSize: "1rem",
              opacity: canSave ? 1 : 0.6,
              boxShadow: "none",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              color: "var(--muted)",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
