import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "../models/Person";
import { openSmsComposer } from "../components/SoonReminderCard";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import PeopleIndex from "./PeopleIndex";
import CareSuggestionCard from "../components/CareSuggestionCard";
import { generateCareSuggestions } from "../utils/careSuggestions";
import MicroQuestionCard from "../components/MicroQuestionCard";

type Props = {
  people: Person[];
  activeTab: "soon" | "people";
  onChangeTab: (tab: "soon" | "people") => void;
  onAddPerson: () => void;
  onSelectPerson: (person: Person, sourceTab: "soon" | "people") => void;
  onUpdatePerson: (person: Person) => void;
};

const headerDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function Home({
  people,
  activeTab,
  onChangeTab,
  onAddPerson,
  onSelectPerson,
  onUpdatePerson,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [questionTick, setQuestionTick] = useState(0);
  const [shouldPulseBow, setShouldPulseBow] = useState(false);
  const [arrivalTick, setArrivalTick] = useState(0);
  const previousPeopleCountRef = useRef<number>(people.length);

  const today = useMemo(() => startOfToday(), []);

  const searchTokens = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return trimmed.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  function matchesPersonName(name: string) {
    if (!searchTokens.length) return true;
    const normalized = name.trim().toLowerCase();
    return searchTokens.every((token) => normalized.includes(token));
  }

  const filteredPeople = useMemo(() => {
    if (!searchTokens.length) return people;
    return people.filter((p) => matchesPersonName(p.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, searchTokens.join("|")]);

  const careSuggestions = useMemo(() => {
    if (activeTab !== "soon") return [];
    return generateCareSuggestions(filteredPeople, today);
  }, [activeTab, filteredPeople, today, questionTick]);

  const unsnoozedCareSuggestions = useMemo(() => {
    const now = Date.now();
    function isSnoozed(cardId: string) {
      try {
        const raw = window.localStorage.getItem(`doknotforget_snooze_${cardId}`);
        if (!raw) return false;
        const ts = Number(raw);
        if (Number.isNaN(ts)) return false;
        return ts > now;
      } catch {
        return false;
      }
    }

    return careSuggestions.filter((s) => {
      if (s.type === "question") return true;
      return !isSnoozed(s.id);
    });
  }, [careSuggestions]);

  const visibleCareSuggestions = useMemo(() => {
    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    function isFreshForPerson(personId: string, questionId: string) {
      const keys = [
        `doknotforget_question_answered_${personId}_${questionId}`,
        `doknotforget_question_snoozed_${personId}_${questionId}`,
        `doknotforget_question_seen_${personId}_${questionId}`,
        `doknotforget_question_person_seen_${personId}`,
      ];
      try {
        for (const k of keys) {
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;
          const at = Number(raw);
          if (Number.isNaN(at)) continue;
          if (now - at < cooldownMs) return false;
        }
      } catch {
        // ignore
      }
      return true;
    }

    const sessionHasQuestion =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("doknotforget_session_microquestion_shown") === "1";

    const questions = unsnoozedCareSuggestions.filter((s) => s.type === "question" && s.question);
    const firstEligibleQuestion =
      sessionHasQuestion
        ? null
        : (questions.find((q) => q.question && isFreshForPerson(q.personId, q.question.id)) ?? null);

    return unsnoozedCareSuggestions.filter((s) => {
      if (s.type !== "question" || !s.question) return true;
      if (!firstEligibleQuestion) return false;
      return s.id === firstEligibleQuestion.id;
    });
  }, [unsnoozedCareSuggestions]);

  const activeQuestion = useMemo(() => {
    return visibleCareSuggestions.find((s) => s.type === "question" && s.question) ?? null;
  }, [visibleCareSuggestions]);

  useEffect(() => {
    if (!activeQuestion?.question) return;
    try {
      window.sessionStorage.setItem("doknotforget_session_microquestion_shown", "1");
    } catch {
      // ignore
    }

    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_seen_${activeQuestion.personId}_${activeQuestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${activeQuestion.personId}`, now);
    } catch {
      // ignore
    }
  }, [activeQuestion?.id, activeQuestion?.personId, activeQuestion?.question?.id]);

  function handleSuggestionAction(suggestionId: string) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const person = people.find((p) => p.id === suggestion.personId);
    if (!person) return;

    if (suggestion.action.kind === "view") {
      onSelectPerson(person, "soon");
      return;
    }

    if (suggestion.action.kind === "text") {
      openSmsComposer(person.phone, suggestion.action.body);
      return;
    }

    if (suggestion.action.kind === "giftIdeas") {
      const query = encodeURIComponent(`gift ideas for ${person.name}`);
      const url = `https://www.google.com/search?q=${query}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = url;
    }
  }

  function handleQuestionChoose(suggestionId: string, optionId: string, data?: { text?: string; isoDate?: string }) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion?.question) return;

    const person = people.find((p) => p.id === suggestion.personId);
    if (!person) return;

    let updated: Person | null = null;

    const option = suggestion.question.options.find((o) => o.id === optionId) ?? null;
    if (option) {
      if (option.apply) updated = option.apply(person);
      else if (option.patch) {
        const patch = option.patch;
        updated = {
          ...person,
          ...patch,
          holidayPrefs: {
            ...(person.holidayPrefs ?? {}),
            ...((patch as Person).holidayPrefs ?? {}),
          },
        };
      }
    } else if (suggestion.question.id === "addChildName" && optionId === "save") {
      const name = (data?.text ?? "").trim();
      const child = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: name || undefined };
      updated = {
        ...person,
        hasKids: true,
        children: [...(person.children ?? []), child],
      };
    } else if (suggestion.question.id === "addChildBirthday" && optionId === "save") {
      const iso = (data?.isoDate ?? "").trim();
      const childId = suggestion.question.meta?.childId ?? "";
      if (iso && childId) {
        updated = {
          ...person,
          children: (person.children ?? []).map((c) =>
            c.id === childId ? { ...c, birthday: iso, birthdate: undefined } : c
          ),
        };
      }
    }

    if (!updated) return;

    onUpdatePerson(updated);

    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_answered_${suggestion.personId}_${suggestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${suggestion.personId}`, now);
    } catch {
      // ignore
    }

    setQuestionTick((v) => v + 1);
  }

  function handleQuestionDismiss(suggestionId: string) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion?.question) return;
    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_snoozed_${suggestion.personId}_${suggestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${suggestion.personId}`, now);
    } catch {
      // ignore
    }
    setQuestionTick((v) => v + 1);
  }

  const greetingText = "Here are the moments that matter coming up.";

  useEffect(() => {
    // First-launch bow pulse (once, never repeats).
    try {
      const done = window.localStorage.getItem("doknotforget_bow_pulse_done") === "true";
      if (!done) {
        setShouldPulseBow(true);
        window.localStorage.setItem("doknotforget_bow_pulse_done", "true");
        window.setTimeout(() => setShouldPulseBow(false), 160);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const prev = previousPeopleCountRef.current;
    if (people.length > prev) setArrivalTick((t) => t + 1);
    previousPeopleCountRef.current = people.length;
  }, [people.length]);

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "48px 1.5rem 64px" }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
        <header>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "2.52rem",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ color: "var(--ink)" }}>
                <span className={shouldPulseBow ? "dkf-bow-pulse" : undefined} style={{ display: "inline-block" }}>
                  <BowIcon size={26} />
                </span>
              </span>
              <Brand />
            </h1>
          </div>

          <div
            style={{
              marginTop: "14px",
              color: "var(--ink)",
              fontSize: "1.08rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
              fontFamily: "var(--font-sans)",
            }}
          >
            {greetingText}
          </div>

          <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.85rem", fontFamily: "var(--font-sans)" }}>
            {headerDateFormatter.format(today)}
          </div>

          <div
            aria-hidden="true"
            style={{
              height: 0,
              borderBottom: "1px solid var(--border)",
              marginTop: "18px",
            }}
          />
        </header>

        {people.length ? (
          <div style={{ marginTop: "24px", display: "flex", gap: "1rem", alignItems: "baseline" }}>
            <button
              onClick={() => onChangeTab("soon")}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "1.05rem",
                fontWeight: 600,
                color: activeTab === "soon" ? "var(--ink)" : "var(--muted)",
                fontFamily: "var(--font-sans)",
              }}
            >
              Soon
            </button>
            <div aria-hidden="true" style={{ color: "var(--muted)" }}>
              |
            </div>
            <button
              onClick={() => onChangeTab("people")}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "1.05rem",
                fontWeight: 600,
                color: activeTab === "people" ? "var(--ink)" : "var(--muted)",
                fontFamily: "var(--font-sans)",
              }}
            >
              People
            </button>
          </div>
        ) : null}

        <div style={{ marginTop: people.length ? "18px" : "24px" }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your people…"
            style={{
              width: "100%",
              display: "block",
              padding: "0.85rem 1rem",
              borderRadius: "14px",
              border: "1px solid var(--border-strong)",
              background: "var(--card)",
              color: "var(--ink)",
              fontSize: "1rem",
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>
        </div>

        <main style={{ marginTop: "34px" }}>
          {people.length === 0 ? (
            <div style={{ marginTop: "4.75rem", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
              <div style={{ fontSize: "1.35rem", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                No one added yet.
              </div>
              <div style={{ marginTop: "0.55rem", color: "var(--muted)", maxWidth: "34rem", lineHeight: 1.6 }}>
                Start with someone important.
              </div>
              <div style={{ marginTop: "1.5rem" }}>
                <button
                  onClick={onAddPerson}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "8px",
                    padding: "0.75rem 1.15rem",
                    fontSize: "1rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  + Add someone important
                </button>
              </div>
            </div>
          ) : activeTab === "people" ? (
            <section aria-label="People" style={{ marginTop: "18px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
              {filteredPeople.length === 0 ? (
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No matches found.</div>
                  <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                    Try a different name.
                  </div>
                </div>
              ) : (
                <PeopleIndex people={filteredPeople} today={today} onSelectPerson={(p) => onSelectPerson(p, "people")} />
              )}
            </section>
          ) : (
            <>
              <section aria-labelledby="care-heading" style={{ marginTop: "18px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
                <div
                  id="care-heading"
                  style={{
                    color: "var(--ink)",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-serif)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Moments that matter
                </div>

                {visibleCareSuggestions.length ? (
                  <div key={arrivalTick} className={arrivalTick ? "dkf-arrival" : undefined} style={{ marginTop: "1.5rem", display: "grid", gap: "1.75rem" }}>
                    {visibleCareSuggestions.flatMap((suggestion, idx) => {
                      const items: React.ReactNode[] = [];

                      if (idx === 6 && visibleCareSuggestions.length > 6) {
                        items.push(
                          <div key="more-break" style={{ marginTop: "8px" }}>
                            <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>More moments ahead</div>
                          </div>
                        );
                      }

                      items.push(
                        <div
                          key={suggestion.id}
                          className="dkf-enter"
                          style={{ animationDelay: `${idx * 12}ms` }}
                        >
                          {suggestion.type === "question" && suggestion.question ? (
                            <MicroQuestionCard
                              suggestion={suggestion}
                              onChoose={(optionId, data) => handleQuestionChoose(suggestion.id, optionId, data)}
                              onDismiss={() => handleQuestionDismiss(suggestion.id)}
                            />
                          ) : (
                            <CareSuggestionCard
                              suggestion={suggestion}
                              onAction={() => handleSuggestionAction(suggestion.id)}
                              onSnooze={() => setQuestionTick((v) => v + 1)}
                            />
                          )}
                        </div>
                      );

                      return items;
                    })}
                  </div>
                ) : (
                  <div style={{ marginTop: "1.5rem", padding: "2.25rem 0", textAlign: "center" }}>
                    {searchQuery.trim() && filteredPeople.length === 0 ? (
                      <>
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No matches found.</div>
                        <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                          Try a different name.
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>All calm for now.</div>
                        <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                          Nothing coming up in the next couple of weeks.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              <div
                style={{
                  marginTop: "4.25rem",
                  paddingTop: "1.75rem",
                  borderTop: "1px solid var(--border)",
                  maxWidth: "560px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <button
                  onClick={onAddPerson}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "8px",
                    padding: "0.65rem 1rem",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  + Add someone important
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
