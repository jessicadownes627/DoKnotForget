import { useEffect, useRef, useState } from "react";
import {
  OnboardingBody,
  OnboardingEyebrow,
  OnboardingHeroInvite,
  OnboardingHeroTitle,
  PremiumInput,
  PrimaryButton,
} from "../components/onboarding/OnboardingPrimitives";
import type { Moment, Person } from "../models/Person";
import MomentDatePicker from "../components/MomentDatePicker";
import { useAppState } from "../appState";
import { useLocation, useNavigate } from "../router";
import { normalizePhone } from "../utils/phone";
import { getSelectedHolidays } from "../utils/personHolidays";

const FREE_LIMIT = 3;

type ReminderChoice = "birthday" | "anniversary" | "custom";

const REMINDER_OPTIONS: Array<{ value: ReminderChoice; label: string }> = [
  { value: "birthday", label: "🎂 Birthday" },
  { value: "anniversary", label: "💕 Anniversary" },
  { value: "custom", label: "✨ Another important date" },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function buildBirthdayIso(monthDay: string, year: string) {
  if (!monthDay) return "";
  const parts = parseYmd(monthDay);
  if (!parts) return "";
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const y = year.trim();
  if (!y) return `0000-${mm}-${dd}`;
  return `${y.padStart(4, "0")}-${mm}-${dd}`;
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

function monthDayFromDraft(value: string) {
  const parts = parseYmd(value);
  if (!parts) return "";
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return `${mm}-${dd}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatMonthDay(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 2) return value;
  const m = Number(parts[0]);
  const d = Number(parts[1]);
  if (!m || !d || Number.isNaN(m) || Number.isNaN(d)) return value;
  const parsed = new Date(2000, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function formatMomentDate(value: string) {
  const parts = parseYmd(value);
  if (!parts) return value;
  const displayYear = parts.y > 0 ? parts.y : 2000;
  const parsed = new Date(displayYear, parts.m - 1, parts.d);
  if (Number.isNaN(parsed.getTime())) return value;
  return parts.y > 0 ? dateWithYearFormatter.format(parsed) : dateFormatter.format(parsed);
}

function formatPromptName(name: string) {
  const trimmed = name.trim();
  return trimmed || "this person";
}

function possessive(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "their";
  return trimmed.endsWith("s") ? `${trimmed}'` : `${trimmed}'s`;
}

function findMoment(person: Person | null, type: Moment["type"]) {
  return (person?.moments ?? []).find((moment) => moment.type === type) ?? null;
}

function SurfaceCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={className ? `dkf-enter dkf-memory-section ${className}` : "dkf-enter dkf-memory-section"}
      style={{
        borderRadius: "24px",
        border: "1px solid rgba(28, 28, 30, 0.06)",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 10px 24px rgba(28, 28, 30, 0.035)",
        padding: "1.35rem 1.1rem 1.05rem",
        backdropFilter: "blur(10px)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  label,
  inactiveCopy,
  onClick,
}: {
  active: boolean;
  label: string;
  inactiveCopy: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        borderRadius: "22px",
        border: active ? "1px solid rgba(28, 28, 30, 0.14)" : "1px solid rgba(28, 28, 30, 0.07)",
        background: active
          ? "linear-gradient(180deg, rgba(249,247,243,0.98) 0%, rgba(243,239,233,0.96) 100%)"
          : "rgba(255,255,255,0.72)",
        color: "var(--ink)",
        padding: "1.08rem 1rem",
        display: "grid",
        gap: "0.32rem",
        minHeight: "88px",
        boxShadow: active ? "0 10px 18px rgba(28, 28, 30, 0.05)" : "none",
      }}
    >
      <span style={{ fontSize: "1.02rem", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{inactiveCopy}</span>
    </button>
  );
}

function JourneyIntro({ shimmer, awake }: { shimmer: boolean; awake: boolean }) {
  return (
    <div
      className={awake ? "dkf-journey-intro dkf-journey-intro-awake" : "dkf-journey-intro"}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div className="dkf-journey-glow dkf-journey-glow-left" />
      <div className="dkf-journey-glow dkf-journey-glow-right" />
      <svg
        className={`dkf-journey-path${shimmer ? " dkf-journey-path-shimmer" : ""}`}
        viewBox="0 0 720 520"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <linearGradient id="dkfJourneyStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(248,219,146,0.04)" />
            <stop offset="18%" stopColor="rgba(244,208,124,0.18)" />
            <stop offset="52%" stopColor="rgba(255,245,225,0.94)" />
            <stop offset="100%" stopColor="rgba(241,192,86,0.14)" />
          </linearGradient>
          <filter id="dkfJourneyBlur">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <path
          d="M642 28C676 76 650 138 592 188C530 244 458 294 374 326C292 358 182 388 84 434"
          fill="none"
          stroke="url(#dkfJourneyStroke)"
          strokeWidth="9"
          strokeLinecap="round"
          filter="url(#dkfJourneyBlur)"
          opacity="0.22"
        />
        <path
          d="M642 28C676 76 650 138 592 188C530 244 458 294 374 326C292 358 182 388 84 434"
          fill="none"
          stroke="url(#dkfJourneyStroke)"
          strokeWidth="1.65"
          strokeLinecap="round"
          opacity="0.46"
        />
      </svg>
      <span className="dkf-journey-sparkle dkf-journey-sparkle-1">✦</span>
      <span className="dkf-journey-sparkle dkf-journey-sparkle-2">✦</span>
      <span className="dkf-journey-sparkle dkf-journey-sparkle-3">✦</span>
      <span className="dkf-journey-orb" />
      <span className="dkf-journey-orb dkf-journey-orb-secondary" />
    </div>
  );
}

export default function AddPerson() {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, isPremium, savePerson } = useAppState();

  const editPersonId =
    (location.state as any)?.personId ?? (location.state as any)?.editPersonId ?? null;
  const editingPerson =
    (editPersonId ? people.find((p) => p.id === editPersonId) : null) ??
    ((location.state as any)?.person as Person | undefined) ??
    null;

  const birthdayMoment = findMoment(editingPerson, "birthday");
  const [name, setName] = useState(editingPerson?.name ?? "");
  const [isNameSettled, setIsNameSettled] = useState(Boolean(editingPerson?.name?.trim()));
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [trailPulse, setTrailPulse] = useState(false);
  const [phone, setPhone] = useState(editingPerson?.phone ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const [birthdayMonthDay, setBirthdayMonthDay] = useState(
    birthdayMoment?.date ? toDraftFromIso(birthdayMoment.date).monthDay : ""
  );
  const [birthdayYear, setBirthdayYear] = useState(
    birthdayMoment?.date ? toDraftFromIso(birthdayMoment.date).year : ""
  );
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState(birthdayMonthDay);
  const [birthdayDraftYear, setBirthdayDraftYear] = useState(birthdayYear);
  const [anniversary, setAnniversary] = useState((editingPerson?.anniversary ?? "").trim());
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState(
    anniversary ? toDraftFromIso(`0000-${anniversary}`).monthDay : ""
  );
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");
  const [customMoments, setCustomMoments] = useState<Array<{ title: string; date: string }>>(
    (editingPerson?.moments ?? [])
      .filter((moment) => moment.type === "custom")
      .map((moment) => ({ title: moment.label, date: moment.date }))
  );
  const [activeReminder, setActiveReminder] = useState<ReminderChoice | null>(null);
  const [isCustomMomentOpen, setIsCustomMomentOpen] = useState(false);
  const [customMomentTitle, setCustomMomentTitle] = useState("");
  const [customMomentDate, setCustomMomentDate] = useState("");
  const [customDraftMonthDay, setCustomDraftMonthDay] = useState("");
  const [customDraftYear, setCustomDraftYear] = useState("");
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [hasInteractedWithReminderArea, setHasInteractedWithReminderArea] = useState(
    Boolean(birthdayMoment?.date || anniversary || customMoments.length)
  );
  const lastPrefilledPersonIdRef = useRef<string | null>(null);
  const previousHasNameRef = useRef(Boolean((editingPerson?.name ?? "").trim()));

  useEffect(() => {
    if (!editingPerson?.id) {
      lastPrefilledPersonIdRef.current = null;
      return;
    }
    if (lastPrefilledPersonIdRef.current === editingPerson.id) return;
    lastPrefilledPersonIdRef.current = editingPerson.id;
    setName(editingPerson.name || "");
    setIsNameSettled(Boolean(editingPerson.name?.trim()));
    setPhone(editingPerson.phone || "");
    setPhoneError(false);
  }, [editingPerson]);

  const promptName = formatPromptName(name);
  const promptPossessive = possessive(name);
  const hasName = Boolean(name.trim());
  const canSaveCustomMoment = Boolean(customMomentTitle.trim() && customMomentDate);
  const hasAnyReminder = Boolean(
    buildBirthdayIso(birthdayMonthDay, birthdayYear) || anniversary || customMoments.length
  );
  const showStorySteps = isNameSettled;
  const canShowReminderCard = hasName;
  const canShowPhoneCard = canShowReminderCard && hasAnyReminder;
  const canSave = hasName && hasAnyReminder;
  const introStage = !showStorySteps;
  const savedBirthdayLabel = buildBirthdayIso(birthdayMonthDay, birthdayYear)
    ? formatMomentDate(buildBirthdayIso(birthdayMonthDay, birthdayYear))
    : null;
  const savedAnniversaryLabel = anniversary ? formatMonthDay(anniversary) : null;

  useEffect(() => {
    if (!introStage || hasName) return;
    const startTimer = window.setTimeout(() => {
      setTrailPulse(true);
    }, 700);
    const stopTimer = window.setTimeout(() => {
      setTrailPulse(false);
    }, 1600);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(stopTimer);
    };
  }, [hasName, introStage]);

  useEffect(() => {
    if (!previousHasNameRef.current && hasName) {
      setTrailPulse(true);
      const timer = window.setTimeout(() => setTrailPulse(false), 1150);
      previousHasNameRef.current = true;
      return () => window.clearTimeout(timer);
    }
    previousHasNameRef.current = hasName;
    return;
  }, [hasName]);

  useEffect(() => {
    if (!hasName) {
      setIsNameSettled(false);
      return;
    }
    if (name.trim().length < 2) {
      setIsNameSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setIsNameSettled(true), 700);
    return () => window.clearTimeout(timer);
  }, [hasName, name]);

  function resetCustomDraft() {
    setCustomMomentTitle("");
    setCustomMomentDate("");
    setCustomDraftMonthDay("");
    setCustomDraftYear("");
    setIsCustomDatePickerOpen(false);
    setIsCustomMomentOpen(false);
  }

  function handleSaveCustomMoment() {
    if (!customMomentTitle.trim() || !customMomentDate) return;
    setCustomMoments((prev) => [...prev, { title: customMomentTitle.trim(), date: customMomentDate }]);
    resetCustomDraft();
  }

  function deleteCustomMomentByIndex(index: number) {
    setCustomMoments((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleSave() {
    if (!name.trim()) return;

    const normalizedPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      setPhoneError(true);
      return;
    }

    const birthdayIso = buildBirthdayIso(birthdayMonthDay, birthdayYear);
    const moments: Moment[] = [];
    if (birthdayIso) {
      moments.push({
        id: makeId(),
        type: "birthday",
        label: "Birthday",
        date: birthdayIso,
        recurring: true,
      });
    }
    if (anniversary) {
      moments.push({
        id: makeId(),
        type: "anniversary",
        label: "Anniversary",
        date: `0000-${anniversary}`,
        recurring: true,
      });
    }
    for (const custom of customMoments) {
      if (!custom.title.trim() || !custom.date) continue;
      moments.push({
        id: makeId(),
        type: "custom",
        label: custom.title.trim(),
        date: custom.date,
        recurring: true,
      });
    }

    const personId = editingPerson?.id ?? makeId();

    const person: Person = {
      ...(editingPerson ?? {}),
      id: personId,
      name: name.trim(),
      phone: normalizedPhone || undefined,
      moments,
      anniversary: anniversary || undefined,
      hasKids: editingPerson?.hasKids,
      selectedHolidays: editingPerson ? getSelectedHolidays(editingPerson) : undefined,
      children: editingPerson?.children,
      importantDates: moments.filter((moment) => moment.type === "custom"),
    };

    if (!editingPerson && !isPremium && people.length >= FREE_LIMIT) {
      navigate("/paywall", {
        state: {
          fallbackPath: "/contacts",
          source: "people-limit",
        },
      });
      return;
    }

    savePerson({
      person,
      createdPeople: [],
      createdRelationships: [],
      createdRelationshipLinksV2: [],
      replaceRelationshipLinksV2ForPersonId: null,
    });

    if (editingPerson) {
      navigate("/home", {
        state: {
          defaultTab: "home",
          ...(person.partnerId ? { showPartnerLinkCheck: person.id } : null),
        },
      });
      return;
    }

    navigate("/contacts", {
      state: {
        circleSuccessMessage: `${person.name.trim() || "Someone"} is in your circle.`,
        addedPersonId: person.id,
      },
    });
  }

  const pageBackground = introStage
    ? [
        "radial-gradient(circle at 18% 16%, rgba(255, 247, 236, 0.9) 0%, rgba(255, 238, 212, 0.26) 22%, rgba(255, 238, 212, 0) 46%)",
        "radial-gradient(circle at 78% 22%, rgba(241, 223, 226, 0.32) 0%, rgba(241, 223, 226, 0.08) 20%, rgba(241, 223, 226, 0) 42%)",
        "radial-gradient(circle at 42% 44%, rgba(250, 234, 198, 0.18) 0%, rgba(250, 234, 198, 0) 36%)",
        "linear-gradient(180deg, rgba(249,244,238,1) 0%, rgba(243,235,226,1) 100%)",
      ].join(", ")
    : [
        "radial-gradient(circle at 20% 16%, rgba(255, 246, 234, 0.74) 0%, rgba(255, 246, 234, 0) 30%)",
        "radial-gradient(circle at 82% 18%, rgba(236, 214, 218, 0.26) 0%, rgba(236, 214, 218, 0) 28%)",
        "linear-gradient(180deg, rgba(246,239,232,1) 0%, rgba(241,233,224,1) 100%)",
      ].join(", ");

  return (
    <div style={{ background: pageBackground, color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top) + 28px) 16px calc(120px + env(safe-area-inset-bottom)) 16px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "grid", gap: showStorySteps ? "2rem" : "1.8rem" }}>
          <section
            className={hasName ? "dkf-enter dkf-journey-stage-ready" : "dkf-enter"}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "34px",
              padding: "0.95rem 0 1.4rem",
              minHeight: showStorySteps ? "auto" : "760px",
            }}
          >
              <JourneyIntro shimmer={trailPulse} awake={isNameFocused || hasName} />
              <header
                style={{
                  position: "relative",
                  zIndex: 1,
                  paddingTop: "1.2rem",
                  maxWidth: "420px",
                }}
              >
                <OnboardingEyebrow>DoKnotForget</OnboardingEyebrow>
                <OnboardingHeroTitle>
                  <>
                    <span style={{ display: "block", whiteSpace: "nowrap" }}>Every meaningful connection</span>
                    <span style={{ display: "block" }}>starts with a person.</span>
                  </>
                </OnboardingHeroTitle>
                <OnboardingHeroInvite>Let&apos;s begin their story.</OnboardingHeroInvite>
              </header>

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  marginTop: "28px",
                }}
              >
                <PremiumInput
                  shellClassName={hasName ? "dkf-journey-input-hero dkf-journey-input-ready" : "dkf-journey-input-hero"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setIsNameFocused(true)}
                  onBlur={() => setIsNameFocused(false)}
                  autoFocus
                  placeholder="Enter their name"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.75" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M5.5 19.25C6.2 16.55 8.58 14.75 12 14.75C15.42 14.75 17.8 16.55 18.5 19.25"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />
              </div>

              <div
                className="dkf-journey-note"
                style={{
                  position: "relative",
                  zIndex: 1,
                  marginTop: "3.6rem",
                  marginLeft: "1.75rem",
                }}
              >
                <OnboardingBody>
                  Just one name to start.
                  <br />
                  We&apos;ll build it together. ♡
                </OnboardingBody>
              </div>

          </section>

          {canShowReminderCard ? (
            <SurfaceCard>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "1.14rem", fontWeight: 600, color: "var(--ink)" }}>
                    What would you like us to remember about {promptName}?
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.8rem",
                  }}
                >
                  {REMINDER_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      active={
                        option.value === "birthday"
                          ? Boolean(savedBirthdayLabel)
                          : option.value === "anniversary"
                            ? Boolean(savedAnniversaryLabel)
                            : customMoments.length > 0
                      }
                      label={
                        option.value === "birthday"
                          ? `🎂 ${promptPossessive} birthday`
                          : option.value === "anniversary"
                            ? `💕 ${promptName}'s anniversary`
                            : "✨ Another important date"
                      }
                      inactiveCopy={
                        option.value === "birthday"
                          ? "A day worth remembering."
                          : option.value === "anniversary"
                            ? "Worth honoring well."
                            : "A moment that matters."
                      }
                      onClick={() => {
                        setHasInteractedWithReminderArea(true);
                        if (option.value === "birthday") {
                          setBirthdayDraftMonthDay(birthdayMonthDay);
                          setBirthdayDraftYear(birthdayYear);
                          setActiveReminder("birthday");
                          return;
                        }
                        if (option.value === "anniversary") {
                          const draft = anniversary ? toDraftFromIso(`0000-${anniversary}`) : { monthDay: "", year: "" };
                          setAnniversaryDraftMonthDay(draft.monthDay);
                          setAnniversaryDraftYear("");
                          setActiveReminder("anniversary");
                          return;
                        }
                        setActiveReminder(null);
                        setIsCustomMomentOpen(true);
                      }}
                    />
                  ))}
                </div>

                {hasInteractedWithReminderArea && hasAnyReminder ? (
                  <div className="dkf-fade-in-140" style={{ display: "grid", gap: "0.55rem" }}>
                    {savedBirthdayLabel ? (
                      <div style={{ color: "var(--ink)", fontSize: "0.95rem" }}>🎂 {promptPossessive} birthday: {savedBirthdayLabel}</div>
                    ) : null}
                    {savedAnniversaryLabel ? (
                      <div style={{ color: "var(--ink)", fontSize: "0.95rem" }}>💕 {promptPossessive} anniversary: {savedAnniversaryLabel}</div>
                    ) : null}
                    {customMoments.slice(0, 2).map((moment, index) => (
                      <div key={`inline-${moment.title}-${index}`} style={{ color: "var(--ink)", fontSize: "0.95rem" }}>
                        ✨ {moment.title}: {formatMomentDate(moment.date)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </SurfaceCard>
          ) : null}

          <MomentDatePicker
            isOpen={activeReminder === "birthday"}
            title={`${promptPossessive} birthday`}
            mode="birthday"
            monthDay={birthdayDraftMonthDay}
            setMonthDay={setBirthdayDraftMonthDay}
            year={birthdayDraftYear}
            setYear={setBirthdayDraftYear}
            yearHelperText="The year helps with milestone birthdays and age-based reminders."
            onSave={() => {
              setBirthdayMonthDay(birthdayDraftMonthDay);
              setBirthdayYear(birthdayDraftYear);
              setActiveReminder(null);
            }}
            onCancel={() => setActiveReminder(null)}
            onClear={() => {
              setBirthdayDraftMonthDay("");
              setBirthdayDraftYear("");
              setBirthdayMonthDay("");
              setBirthdayYear("");
            }}
          />

          <MomentDatePicker
            isOpen={activeReminder === "anniversary"}
            title={`${promptName}'s anniversary`}
            mode="anniversary"
            monthDay={anniversaryDraftMonthDay}
            setMonthDay={setAnniversaryDraftMonthDay}
            year={anniversaryDraftYear}
            setYear={setAnniversaryDraftYear}
            yearHelperText=""
            onSave={() => {
              const mmdd = monthDayFromDraft(anniversaryDraftMonthDay);
              if (!mmdd) return;
              setAnniversary(mmdd);
              setActiveReminder(null);
            }}
            onCancel={() => setActiveReminder(null)}
            onClear={() => {
              setAnniversaryDraftMonthDay("");
              setAnniversaryDraftYear("");
              setAnniversary("");
            }}
          />

          {isCustomMomentOpen ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Important date"
              onClick={resetCustomDraft}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(10, 14, 20, 0.22)",
                display: "grid",
                placeItems: "center",
                padding: "1.25rem",
                zIndex: 80,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: "540px",
                  borderRadius: "26px",
                  border: "1px solid rgba(10, 27, 42, 0.08)",
                  background: "rgba(255,255,255,0.98)",
                  boxShadow: "0 24px 60px rgba(20, 16, 10, 0.16)",
                  padding: "1.2rem",
                  display: "grid",
                  gap: "0.9rem",
                }}
              >
                <div style={{ fontSize: "1.08rem", fontWeight: 600, color: "var(--ink)" }}>
                  What should we remember for {promptName}?
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.88rem", fontWeight: 600 }}>Title</div>
                <input
                  value={customMomentTitle}
                  onChange={(e) => setCustomMomentTitle(e.target.value)}
                  placeholder="What would you like to remember?"
                  style={{
                    width: "100%",
                    padding: "0.95rem 1rem",
                    borderRadius: "16px",
                    border: "1px solid rgba(10, 27, 42, 0.1)",
                    background: "rgba(255,255,255,0.95)",
                  }}
                />
                <div style={{ color: "var(--muted)", fontSize: "0.88rem", fontWeight: 600 }}>Date</div>
                <button
                  type="button"
                  onClick={() => {
                    const draft = toDraftFromIso(customMomentDate);
                    setCustomDraftMonthDay(draft.monthDay);
                    setCustomDraftYear(draft.year);
                    setIsCustomDatePickerOpen(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderRadius: "16px",
                    border: "1px solid rgba(10, 27, 42, 0.1)",
                    background: "rgba(255,255,255,0.95)",
                    color: "var(--ink)",
                  }}
                >
                  <span>Date</span>
                  <span style={{ color: "var(--muted)" }}>
                    {customMomentDate ? formatMomentDate(customMomentDate) : "Month, day, year"}
                  </span>
                </button>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <button
                    type="button"
                    onClick={resetCustomDraft}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      color: "var(--muted)",
                      fontSize: "0.92rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomMoment}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      color: canSaveCustomMoment ? "var(--ink)" : "var(--muted)",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      cursor: canSaveCustomMoment ? "pointer" : "default",
                      opacity: canSaveCustomMoment ? 1 : 0.6,
                    }}
                    disabled={!canSaveCustomMoment}
                  >
                    Add this date
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <MomentDatePicker
            isOpen={isCustomDatePickerOpen}
            title="Important date"
            mode="custom"
            monthDay={customDraftMonthDay}
            setMonthDay={setCustomDraftMonthDay}
            year={customDraftYear}
            setYear={setCustomDraftYear}
            yearHelperText="Add the year if you know it."
            onSave={() => {
              const iso = buildMomentIso(customDraftMonthDay, customDraftYear, false);
              if (!iso) return;
              setCustomMomentDate(iso);
              setIsCustomDatePickerOpen(false);
            }}
            onCancel={() => setIsCustomDatePickerOpen(false)}
            onClear={() => {
              setCustomDraftMonthDay("");
              setCustomDraftYear("");
              setCustomMomentDate("");
            }}
          />

          {canShowPhoneCard ? (
            <SurfaceCard>
              <div style={{ display: "grid", gap: "1rem" }}>
                {customMoments.length ? (
                  <div style={{ display: "grid", gap: "0.6rem" }}>
                    {customMoments.map((moment, index) => (
                      <div
                        key={`${moment.title}-${moment.date}-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.96)",
                          padding: "0.95rem 1rem",
                          border: "1px solid rgba(28, 28, 30, 0.06)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "var(--ink)", fontSize: "0.95rem", fontWeight: 600 }}>
                            {moment.title}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
                            {formatMomentDate(moment.date)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCustomMomentByIndex(index)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--muted)",
                            padding: 0,
                            fontSize: "0.88rem",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gap: "0.85rem",
                    padding: "0.85rem 0.95rem",
                    borderRadius: "22px",
                    border: "1px solid rgba(28, 28, 30, 0.05)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,244,239,0.76) 100%)",
                  }}
                >
                  <div style={{ color: "var(--ink)", fontWeight: 600 }}>Texting makes this easy later</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
                    Add a number so you can text {promptName} in one tap when it matters.
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPhone(next);
                      if (!next.trim()) setPhoneError(false);
                      else if (normalizePhone(next)) setPhoneError(false);
                    }}
                    placeholder="Phone number"
                    style={{
                      width: "100%",
                      padding: "0.98rem 1rem",
                      borderRadius: "18px",
                      border: "1px solid rgba(28, 28, 30, 0.08)",
                      background: "rgba(255,255,255,0.98)",
                    }}
                  />
                  {phoneError ? (
                    <div style={{ color: "#b42318", fontSize: "0.86rem" }}>Enter a valid phone number.</div>
                  ) : null}
                </div>
              </div>
            </SurfaceCard>
          ) : null}

        </div>
      </div>

      <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
          padding: introStage
            ? "16px 16px calc(18px + env(safe-area-inset-bottom))"
            : "12px 16px calc(12px + env(safe-area-inset-bottom))",
          background: introStage
            ? "linear-gradient(180deg, rgba(247,241,232,0) 0%, rgba(247,241,232,0.86) 20%, rgba(247,241,232,0.97) 100%)"
            : "linear-gradient(180deg, rgba(244,239,231,0) 0%, rgba(244,239,231,0.92) 22%, rgba(244,239,231,0.98) 100%)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: introStage ? "1rem" : "0.85rem",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/home")}
            style={{
              padding: introStage ? "1.28rem 1.5rem" : "0.95rem 1rem",
              background: introStage
                ? "rgba(255,255,255,0.92)"
                : "rgba(255,255,255,0.9)",
              color: introStage ? "var(--ink)" : "var(--muted)",
              border: introStage
                ? "1px solid rgba(28, 28, 30, 0.08)"
                : "1px solid rgba(28, 28, 30, 0.08)",
              borderRadius: introStage ? "28px" : "18px",
              minWidth: introStage ? "140px" : "96px",
              boxShadow: introStage ? "0 10px 24px rgba(28, 28, 30, 0.05)" : "none",
              fontSize: introStage ? "1.02rem" : "1rem",
              fontWeight: introStage ? 600 : 500,
            }}
          >
            Cancel
          </button>
          <PrimaryButton
            onClick={handleSave}
            disabled={!canSave}
            quietDisabled
            style={{
              flex: 1,
              padding: showStorySteps ? "1rem 1.2rem" : "1.34rem 1.4rem",
              borderRadius: showStorySteps ? "20px" : "999px",
              transform: "scale(1)",
            }}
          >
            {hasName ? `Add ${promptName} to My Circle` : "Add to My Circle"}
          </PrimaryButton>
        </div>
        {introStage ? (
          <div
            style={{
              maxWidth: "760px",
              margin: "1rem auto 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.45rem",
              color: "rgba(10, 27, 42, 0.56)",
              fontSize: "0.92rem",
              textAlign: "center",
            }}
          >
            <span aria-hidden="true" style={{ color: "rgba(197, 144, 51, 0.94)" }}>
              🔒
            </span>
            <span>Your memories are always private and secure.</span>
          </div>
        ) : null}
        {hasName && !canSave ? (
          <div
            style={{
              maxWidth: "760px",
              margin: "0.55rem auto 0",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
          </div>
        ) : null}
      </div>
    </div>
  );
}
