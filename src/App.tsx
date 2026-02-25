import { useEffect, useState } from "react";
import Home from "./screens/Home";
import AddPerson from "./screens/AddPerson";
import PersonDetail from "./screens/PersonDetail";
import Onboarding from "./screens/Onboarding";
import type { Person } from "./models/Person";
import type { Relationship } from "./models/Relationship";

type Screen = "home" | "add-person";
type HomeTab = "soon" | "people";

const PEOPLE_STORAGE_KEY = "doknotforget_people";
const RELATIONSHIPS_STORAGE_KEY = "doknotforget_relationships";
const ONBOARDING_STORAGE_KEY = "doknotforget_onboardingComplete";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("soon");
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [hasHydratedOnboarding, setHasHydratedOnboarding] = useState(false);

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
    setHasHydratedStorage(true);
    setHasHydratedOnboarding(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    window.localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(people));
  }, [hasHydratedStorage, people]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    window.localStorage.setItem(RELATIONSHIPS_STORAGE_KEY, JSON.stringify(relationships));
  }, [hasHydratedStorage, relationships]);

  useEffect(() => {
    if (!hasHydratedOnboarding) return;
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, onboardingComplete ? "true" : "false");
    } catch {
      // ignore
    }
  }, [hasHydratedOnboarding, onboardingComplete]);

  const selectedPerson = selectedPersonId
    ? people.find((p) => p.id === selectedPersonId) ?? null
    : null;

  const editingPerson = editingPersonId
    ? people.find((p) => p.id === editingPersonId) ?? null
    : null;

  function handleSavePerson(payload: {
    person: Person;
    createdPeople: Person[];
    createdRelationships: Relationship[];
  }) {
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
    if (editingPersonId) {
      setSelectedPersonId(payload.person.id);
      setEditingPersonId(null);
      setScreen("home");
    } else {
      setScreen("home");
    }
  }

  if (!hasHydratedOnboarding) return null;

  if (!onboardingComplete) {
    return (
      <Onboarding
        onCreateFirstPerson={(person) => {
          setPeople((prev) => {
            const byId = new Map<string, Person>();
            for (const p of prev) byId.set(p.id, p);
            byId.set(person.id, person);
            return Array.from(byId.values());
          });
        }}
        onComplete={() => {
          setOnboardingComplete(true);
          setScreen("home");
        }}
      />
    );
  }

  if (screen === "add-person") {
    return (
      <AddPerson
        people={people}
        person={editingPerson ?? undefined}
        onSave={handleSavePerson}
        onBack={() => {
          if (editingPersonId) {
            setScreen("home");
          } else {
            setScreen("home");
          }
        }}
      />
    );
  }

  if (selectedPerson) {
    return (
      <PersonDetail
        person={selectedPerson}
        people={people}
        relationships={relationships}
        onSelectPerson={(p) => {
          setSelectedPersonId(p.id);
          setScreen("home");
        }}
        onEdit={() => {
          setEditingPersonId(selectedPerson.id);
          setScreen("add-person");
        }}
        onUpdatePerson={(updated) => {
          setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
        onBack={() => {
          setSelectedPersonId(null);
          setScreen("home");
        }}
      />
    );
  }

  return (
    <Home
      people={people}
      activeTab={homeTab}
      onChangeTab={setHomeTab}
      onAddPerson={() => setScreen("add-person")}
      onSelectPerson={(person, sourceTab) => {
        setHomeTab(sourceTab);
        setSelectedPersonId(person.id);
        setScreen("home");
      }}
      onUpdatePerson={(updated) => {
        setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }}
    />
  );
}

export default App;
