import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Person } from "./models/Person";
import type { Relationship } from "./models/Relationship";
import { normalizePhone } from "./utils/phone";

type SavePersonPayload = {
  person: Person;
  createdPeople: Person[];
  createdRelationships: Relationship[];
};

type AppState = {
  hasHydrated: boolean;
  onboardingComplete: boolean;
  people: Person[];
  relationships: Relationship[];
  markOnboardingComplete: () => void;
  createPerson: (person: Person) => void;
  savePerson: (payload: SavePersonPayload) => void;
  updatePerson: (person: Person) => void;
  updatePersonFields: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
};

const PEOPLE_STORAGE_KEY = "doknotforget_people";
const RELATIONSHIPS_STORAGE_KEY = "doknotforget_relationships";
const ONBOARDING_STORAGE_KEY = "doknotforget_onboardingComplete";

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  useEffect(() => {
    const debugHydration = (() => {
      try {
        return window.localStorage.getItem("dkf_debug_hydration") === "1";
      } catch {
        return false;
      }
    })();

    let hydratedPeople: Person[] = [];
    try {
      const rawPeople = window.localStorage.getItem(PEOPLE_STORAGE_KEY);
      if (rawPeople) {
        const parsed = JSON.parse(rawPeople);
        if (Array.isArray(parsed)) hydratedPeople = parsed as Person[];
      }
    } catch {
      // ignore
    }
    if (hydratedPeople.length) {
      hydratedPeople = hydratedPeople.map((p) => {
        const rawPhone = (p.phone ?? "").trim();
        if (!rawPhone) return p;
        const normalized = normalizePhone(rawPhone);
        return normalized ? { ...p, phone: normalized } : p;
      });
    }

    try {
      const rawRelationships = window.localStorage.getItem(RELATIONSHIPS_STORAGE_KEY);
      if (rawRelationships) {
        const parsed = JSON.parse(rawRelationships);
        if (Array.isArray(parsed)) setRelationships(parsed as Relationship[]);
      }
    } catch {
      // ignore
    }

    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const flag = raw === "true";
      setOnboardingComplete(flag || hydratedPeople.length > 0);
    } catch {
      setOnboardingComplete(hydratedPeople.length > 0);
    }

    if (hydratedPeople.length) setPeople(hydratedPeople);
    setHasHydrated(true);

    if (debugHydration) {
      // eslint-disable-next-line no-console
      console.log("[DKF DEBUG] Hydrated people array:", hydratedPeople);

      const summary = hydratedPeople.map((p) => {
        const moments = (p as any)?.moments;
        const hasMomentsArray = Array.isArray(moments);
        const birthday = hasMomentsArray ? moments.find((m: any) => m?.type === "birthday") : null;
        return {
          id: (p as any)?.id,
          name: (p as any)?.name,
          momentsIsArray: hasMomentsArray,
          momentsCount: hasMomentsArray ? moments.length : null,
          birthdayMomentDate: birthday?.date ?? null,
          religionCultureType: Array.isArray((p as any)?.religionCulture)
            ? "array"
            : typeof (p as any)?.religionCulture,
        };
      });
      // eslint-disable-next-line no-console
      console.log("[DKF DEBUG] Hydration summary:", summary);

      const mike =
        hydratedPeople.find((p) => (p?.name ?? "").toLowerCase().includes("mike")) ?? null;
      if (mike) {
        const birthday = (mike.moments ?? []).find((m) => m.type === "birthday") ?? null;
        // eslint-disable-next-line no-console
        console.log("[DKF DEBUG] Mike record:", mike);
        // eslint-disable-next-line no-console
        console.log("[DKF DEBUG] Mike birthday moment:", birthday);
      } else {
        // eslint-disable-next-line no-console
        console.log("[DKF DEBUG] No person matching name includes 'mike' found.");
      }
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
    } catch {
      // ignore
    }
  }, [hasHydrated, people]);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(RELATIONSHIPS_STORAGE_KEY, JSON.stringify(relationships));
    } catch {
      // ignore
    }
  }, [hasHydrated, relationships]);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, onboardingComplete ? "true" : "false");
    } catch {
      // ignore
    }
  }, [hasHydrated, onboardingComplete]);

  const value = useMemo<AppState>(() => {
    return {
      hasHydrated,
      onboardingComplete,
      people,
      relationships,
      markOnboardingComplete: () => setOnboardingComplete(true),
      createPerson: (person: Person) => {
        setPeople((prev) => {
          const byId = new Map<string, Person>();
          for (const p of prev) byId.set(p.id, p);
          byId.set(person.id, person);
          const next = Array.from(byId.values());
          if (prev.length === 0 && next.length > 0) {
            try {
              window.localStorage.setItem("doknotforget_just_added_first_contact", String(Date.now()));
            } catch {
              // ignore
            }
          }
          return next;
        });
      },
      savePerson: (payload: SavePersonPayload) => {
        setPeople((prev) => {
          const byId = new Map<string, Person>();
          for (const p of prev) byId.set(p.id, p);
          byId.set(payload.person.id, payload.person);
          for (const p of payload.createdPeople) {
            if (!byId.has(p.id)) byId.set(p.id, p);
          }
          const next = Array.from(byId.values());
          if (prev.length === 0 && next.length > 0) {
            try {
              window.localStorage.setItem("doknotforget_just_added_first_contact", String(Date.now()));
            } catch {
              // ignore
            }
          }
          return next;
        });
        setRelationships((prev) => [...prev, ...payload.createdRelationships]);
      },
      updatePerson: (person: Person) => {
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, ...person } : p))
        );
      },
      updatePersonFields: (id: string, patch: Partial<Person>) => {
        setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      },
      deletePerson: (id: string) => {
        setPeople((prev) =>
          prev
            .filter((p) => p.id !== id)
            .map((p) => (p.partnerId === id ? { ...p, partnerId: null } : p))
        );
        setRelationships((prev) => prev.filter((r) => r.fromId !== id && r.toId !== id));
      },
    };
  }, [hasHydrated, onboardingComplete, people, relationships]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
