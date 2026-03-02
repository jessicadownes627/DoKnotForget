import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { Person } from "./models/Person";
import type { Relationship } from "./models/Relationship";

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
          return Array.from(byId.values());
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
          return Array.from(byId.values());
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
    };
  }, [hasHydrated, onboardingComplete, people, relationships]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
