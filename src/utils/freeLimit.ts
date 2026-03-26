import type { Person } from "../models/Person";

export const FREE_PEOPLE_LIMIT = 3;

export function countNetNewPeople(existingPeople: Person[], incomingPeople: Person[]) {
  const existingIds = new Set(existingPeople.map((person) => person.id));
  let newCount = 0;

  for (const person of incomingPeople) {
    if (existingIds.has(person.id)) continue;
    existingIds.add(person.id);
    newCount += 1;
  }

  return newCount;
}

export function wouldExceedFreePeopleLimit(existingPeople: Person[], incomingPeople: Person[]) {
  return existingPeople.length + countNetNewPeople(existingPeople, incomingPeople) > FREE_PEOPLE_LIMIT;
}
