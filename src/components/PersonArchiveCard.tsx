import type { ReactNode } from "react";
import type { Moment, Person } from "../models/Person";

type NextMomentSummary = {
  label: string;
  date: Date;
};

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function momentLabel(moment: Moment) {
  if (moment.type === "birthday") return "Birthday";
  if (moment.type === "anniversary") return "Anniversary";
  if (moment.type === "custom") return moment.label;
  return titleCase(moment.type);
}

function getNextMomentSummary(person: Person, today: Date): NextMomentSummary | null {
  const base = startOfDay(today);
  const candidates: NextMomentSummary[] = [];

  for (const moment of person.moments) {
    const parsed = parseIsoDate(moment.date);
    if (!parsed) continue;

    if (moment.recurring) {
      const month = parsed.getMonth();
      const day = parsed.getDate();
      const thisYear = new Date(base.getFullYear(), month, day);
      if (thisYear.getMonth() !== month || thisYear.getDate() !== day) continue;
      const target = thisYear < base ? new Date(base.getFullYear() + 1, month, day) : thisYear;
      if (target.getMonth() !== month || target.getDate() !== day) continue;
      candidates.push({ label: momentLabel(moment), date: target });
      continue;
    }

    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (target < base) continue;
    candidates.push({ label: momentLabel(moment), date: target });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return candidates[0] ?? null;
}

type Props = {
  person: Person;
  displayName?: string;
  phone?: string;
  momentSummaryOverride?: string | null;
  today?: Date;
  onClick?: () => void;
  children?: ReactNode;
};

export default function PersonArchiveCard({
  person,
  displayName,
  phone,
  momentSummaryOverride,
  today = new Date(),
  onClick,
  children,
}: Props) {
  const name = (displayName ?? person.name).trim();
  const initial = (person.name.trim().charAt(0) || "?").toUpperCase();
  const resolvedPhone = (phone ?? person.phone ?? "").trim();

  const next = momentSummaryOverride
    ? { text: momentSummaryOverride }
    : (() => {
        const summary = getNextMomentSummary(person, today);
        if (!summary) return null;
        return { text: `${summary.label} · ${monthDayFormatter.format(summary.date)}` };
      })();

  const Wrapper: any = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
        border: "1px solid var(--border)",
        borderRadius: "16px",
        background: "var(--card)",
      }}
    >
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "22px 20px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div
            aria-hidden="true"
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "999px",
              background: "rgba(0,0,0,0.03)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: "var(--ink)",
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              letterSpacing: "0.04em",
              fontSize: "1.1rem",
            }}
          >
            {initial}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                color: "var(--ink)",
                fontSize: "1.55rem",
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              {name}
            </div>

            <div style={{ marginTop: "10px" }}>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div style={{ height: 1, background: "var(--border)", marginTop: 4, opacity: 0.75 }} />
            </div>

            <div style={{ marginTop: "12px", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.4 }}>
              {resolvedPhone ? resolvedPhone : "Phone not added"}
            </div>

            {next ? (
              <div style={{ marginTop: "10px", color: "var(--ink)", fontSize: "0.92rem", lineHeight: 1.45 }}>
                {next.text}
              </div>
            ) : null}

            {children ? <div style={{ marginTop: "14px" }}>{children}</div> : null}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
