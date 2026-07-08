import type { ChildParentContact, Person } from "../models/Person.js";
import type { Relationship } from "../models/Relationship.js";
import { getNextBirthdayFromIso } from "./birthdayUtils.js";
import { parseLocalDate } from "./date.js";
import { buildRelationshipV2Links, resolveRelationshipV2Context } from "./relationshipV2.js";

export type ReminderEventLike = {
  personId: string;
  personName: string;
  momentType: "birthday" | "anniversary" | "childBirthday" | "custom";
  label: string;
  date: string;
  triggerDate: string;
  eventDate: string;
  reminderType: "sevenDay" | "oneDay" | "dayOf";
};

export type ResolvedReminderRecipient = {
  id: string;
  name: string;
  phone: string;
};

export type ResolvedReminderContext = {
  kind: "self" | "childThroughRelationship" | "childBirthday" | "anniversary";
  subjectName: string;
  subjectAge?: number;
  recipients: ResolvedReminderRecipient[];
  actionHeading: string | null;
};

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function contactFirstName(name: string) {
  const trimmed = name.trim();
  return trimmed.split(" ")[0] || trimmed;
}

function joinRecipientFirstNames(recipients: ResolvedReminderRecipient[]) {
  return recipients.map((recipient) => contactFirstName(recipient.name)).join(" & ");
}

export function reminderRelativeLabel(reminderType: ReminderEventLike["reminderType"]) {
  if (reminderType === "dayOf") return "today";
  if (reminderType === "oneDay") return "tomorrow";
  return "in 7 days";
}

export function reminderEventDate(reminder: ReminderEventLike) {
  const parsed = parseLocalDate(reminder.date);
  if (!parsed) return null;
  const offset = reminder.reminderType === "dayOf" ? 0 : reminder.reminderType === "oneDay" ? 1 : 7;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + offset);
}

function calculateAge(birthday: string | undefined, referenceDate = new Date()) {
  if (!birthday) return undefined;

  const [year, month, day] = birthday.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : undefined;
}

function resolveChildParentContacts(person: Person, people: Person[], parents?: ChildParentContact[]) {
  const contacts = (parents ?? [])
    .map((parentContact) => {
      const linkedPerson = parentContact.id ? people.find((candidate) => candidate.id === parentContact.id) ?? null : null;
      const name = (linkedPerson?.name ?? parentContact.name ?? "").trim();
      const phone = (linkedPerson?.phone ?? parentContact.phone ?? "").trim();
      if (!name) return null;
      return {
        id: linkedPerson?.id ?? parentContact.id ?? `${name}:${phone}`,
        name,
        phone,
      };
    })
    .filter((contact): contact is { id: string; name: string; phone: string } => Boolean(contact));

  if (contacts.length > 0) return contacts;

  const fallbackName = person.name.trim();
  return fallbackName
    ? [
        {
          id: person.id,
          name: fallbackName,
          phone: (person.phone ?? "").trim(),
        },
      ]
    : [];
}

function getChildBirthdayContext(reminder: ReminderEventLike, people: Person[], today: Date) {
  if (reminder.momentType !== "childBirthday") return null;

  const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
  if (!person) return null;

  const eventDate = reminderEventDate(reminder);
  const child =
    person.children?.find((candidate) => {
      const birthdayValue = (candidate.birthday ?? candidate.birthdate ?? "").trim();
      if (!birthdayValue) return false;
      const nextBirthday = getNextBirthdayFromIso(birthdayValue, today);
      if (!nextBirthday || !eventDate) return false;
      return nextBirthday.target.getTime() === eventDate.getTime();
    }) ?? null;

  if (!child) return null;

  const childName = (child.name ?? "").trim() || "Your child";
  const birthday = (child.birthday ?? child.birthdate ?? "").trim() || undefined;
  const age = birthday && eventDate ? calculateAge(birthday, eventDate) : undefined;
  const parentContacts = resolveChildParentContacts(person, people, child.parents);
  const hasExplicitParentContacts = Boolean((child.parents ?? []).some((contact) => (contact.name ?? "").trim() || (contact.id ?? "").trim()));
  return {
    parent: person,
    child,
    childName,
    birthday,
    age,
    parentContacts,
    hasExplicitParentContacts,
  };
}

function mapPersonToRecipient(person: Person | null): ResolvedReminderRecipient | null {
  const name = (person?.name ?? "").trim();
  if (!person || !name) return null;
  return {
    id: person.id,
    name,
    phone: (person.phone ?? "").trim(),
  };
}

function mergeRecipients(...groups: ResolvedReminderRecipient[][]) {
  const seen = new Set<string>();
  const merged: ResolvedReminderRecipient[] = [];

  for (const group of groups) {
    for (const recipient of group) {
      const key = recipient.id || `${recipient.name}:${recipient.phone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(recipient);
    }
  }

  return merged;
}

function resolveRecipientsFromAnchoredChildLinks(
  people: Person[],
  reminderRelationshipContext: ReturnType<typeof resolveRelationshipV2Context>
) {
  return reminderRelationshipContext.allLinks
    .flatMap((link) => {
      const anchor = link.anchor;
      if (anchor.kind !== "person" || link.relationshipToAnchor !== "child") return [];
      const recipient = mapPersonToRecipient(
        people.find((candidate) => candidate.id === anchor.personId) ?? null
      );
      return recipient ? [recipient] : [];
    })
    .filter((recipient): recipient is ResolvedReminderRecipient => Boolean(recipient));
}

export function resolveReminderContext(
  reminder: ReminderEventLike,
  people: Person[],
  relationships: Relationship[],
  today: Date,
  relationshipV2Links = buildRelationshipV2Links({ people, relationships })
): ResolvedReminderContext | null {
  const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
  const personName = (person?.name ?? reminder.personName).trim();

  if (reminder.momentType === "childBirthday") {
    const childContext = getChildBirthdayContext(reminder, people, today);
    if (!childContext) return null;

    const childRelationshipContext = resolveRelationshipV2Context({
      subject: {
        kind: "child",
        parentId: childContext.parent.id,
        childId: childContext.child.id,
      },
      people,
      relationships,
      links: relationshipV2Links,
    });

    const anchoredRecipients = resolveRecipientsFromAnchoredChildLinks(people, childRelationshipContext);
    const recipients = childContext.hasExplicitParentContacts
      ? childContext.parentContacts
      : mergeRecipients(anchoredRecipients, childContext.parentContacts);

    return {
      kind: "childBirthday",
      subjectName: childRelationshipContext.subject.name || childContext.childName,
      subjectAge: childContext.age,
      recipients,
      actionHeading:
        recipients.length > 0
          ? `Help ${joinRecipientFirstNames(recipients)} celebrate ${childRelationshipContext.subject.name || childContext.childName}`
          : null,
    };
  }

  if (reminder.momentType === "birthday") {
    if (!person) {
      return personName
        ? {
            kind: "self",
            subjectName: personName,
            recipients: [{ id: reminder.personId, name: personName, phone: "" }],
            actionHeading: null,
          }
        : null;
    }

    const birthdayRelationshipContext = resolveRelationshipV2Context({
      subject: { kind: "person", personId: person.id },
      people,
      relationships,
      links: relationshipV2Links,
    });
    const recipients = resolveRecipientsFromAnchoredChildLinks(people, birthdayRelationshipContext);
    const eventDate = reminderEventDate(reminder);
    const birthdayMoment = (person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
    const birthdayIso = (birthdayMoment?.date ?? "").trim() || undefined;
    const subjectAge = birthdayIso && eventDate ? calculateAge(birthdayIso, eventDate) : undefined;

    if (recipients.length > 0) {
      return {
        kind: "childThroughRelationship",
        subjectName: birthdayRelationshipContext.subject.name || personName,
        subjectAge,
        recipients,
        actionHeading: `Help ${joinRecipientFirstNames(recipients)} celebrate ${birthdayRelationshipContext.subject.name || personName}`,
      };
    }

    const recipient = mapPersonToRecipient(person);
    if (!recipient) return null;
    return {
      kind: "self",
      subjectName: birthdayRelationshipContext.subject.name || personName,
      subjectAge,
      recipients: [recipient],
      actionHeading: null,
    };
  }

  if (reminder.momentType === "anniversary") {
    if (!personName) return null;
    const anniversaryRelationshipContext = person
      ? resolveRelationshipV2Context({
          subject: { kind: "person", personId: person.id },
          people,
          relationships,
          links: relationshipV2Links,
        })
      : null;
    const partnerLink =
      anniversaryRelationshipContext?.allLinks.find(
        (link) => link.anchor.kind === "person" && link.relationshipToAnchor === "partner"
      ) ?? null;
    const partnerAnchor = partnerLink?.anchor;
    const partner =
      partnerAnchor?.kind === "person"
        ? people.find((candidate) => candidate.id === partnerAnchor.personId) ?? null
        : null;
    const subjectName = partner ? `${personName} & ${partner.name}` : personName;
    const recipient = mapPersonToRecipient(person);

    if (!recipient) return null;
    return {
      kind: "anniversary",
      subjectName,
      recipients: [recipient],
      actionHeading: null,
    };
  }

  if (!personName) return null;
  const recipient = mapPersonToRecipient(person) ?? {
    id: reminder.personId,
    name: personName,
    phone: "",
  };
  return {
    kind: "self",
    subjectName: personName,
    recipients: [recipient],
    actionHeading: null,
  };
}

export function buildResolvedReminderLabel(
  reminder: ReminderEventLike,
  people: Person[],
  relationships: Relationship[],
  today: Date,
  relationshipV2Links = buildRelationshipV2Links({ people, relationships })
) {
  const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
  const personName = person?.name ?? reminder.personName;
  const relative = reminderRelativeLabel(reminder.reminderType);
  const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);

  if (reminder.momentType === "birthday") {
    if (reminderContext?.kind === "childThroughRelationship") {
      return reminderContext.subjectAge !== undefined && reminderContext.subjectAge > 0
        ? `${reminderContext.subjectName} turns ${reminderContext.subjectAge} ${relative}`
        : `${possessive(reminderContext.subjectName)} birthday ${relative}`;
    }
    return `${possessive(personName)} birthday ${relative}`;
  }

  if (reminder.momentType === "anniversary") {
    const combinedNames = reminderContext?.kind === "anniversary" ? reminderContext.subjectName : null;
    return combinedNames ? `${combinedNames} anniversary ${relative}` : `${possessive(personName)} anniversary ${relative}`;
  }

  if (reminder.momentType === "childBirthday") {
    if (!reminderContext || reminderContext.kind !== "childBirthday") {
      return reminder.label;
    }

    return reminderContext.subjectAge !== undefined && reminderContext.subjectAge > 0
      ? `${reminderContext.subjectName} turns ${reminderContext.subjectAge} ${relative}`
      : `${reminderContext.subjectName}'s birthday ${relative}`;
  }

  return reminder.label;
}
