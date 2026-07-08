import { buildReminderNotification } from "./notificationScheduler.js";
import { buildRelationshipV2Links } from "./relationshipV2.js";
import { buildResolvedReminderLabel, resolveReminderContext } from "./reminderRelationshipContext.js";
function person(id, name, patch = {}) {
    return {
        id,
        name,
        moments: [],
        ...patch,
    };
}
function assertEqual(label, actual, expected) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
    }
}
function summarizeActions(reminder, people, relationships, today) {
    const links = buildRelationshipV2Links({ people, relationships });
    const context = resolveReminderContext(reminder, people, relationships, today, links);
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const first = ((person?.name ?? reminder.personName).trim().split(" ")[0] || reminder.personName || "them").trim();
    const relationalRecipients = context?.kind === "childThroughRelationship" || context?.kind === "childBirthday" ? context.recipients : [];
    if (relationalRecipients.length > 0 && context) {
        const recipient = relationalRecipients[0];
        const recipientFirst = recipient.name.trim().split(" ")[0] || recipient.name;
        return {
            reminderLabel: buildResolvedReminderLabel(reminder, people, relationships, today, links),
            reminderRecipient: relationalRecipients.map((item) => item.name).join(" & "),
            textActionTarget: `${recipientFirst} about ${context.subjectName}`,
            ecardTarget: relationalRecipients.length === 1
                ? `${recipientFirst} about ${context.subjectName}`
                : "Not available",
            coffeeEligible: false,
            giftEligible: false,
            notificationTitle: buildReminderNotification(reminder, today, undefined, people, relationships)?.title ?? "",
            notificationBody: buildReminderNotification(reminder, today, undefined, people, relationships)?.body ?? "",
        };
    }
    if (reminder.reminderType === "sevenDay") {
        return {
            reminderLabel: buildResolvedReminderLabel(reminder, people, relationships, today, links),
            reminderRecipient: person?.name ?? reminder.personName,
            textActionTarget: "Not available",
            ecardTarget: "Not available",
            coffeeEligible: false,
            giftEligible: true,
            notificationTitle: buildReminderNotification(reminder, today, undefined, people, relationships)?.title ?? "",
            notificationBody: buildReminderNotification(reminder, today, undefined, people, relationships)?.body ?? "",
        };
    }
    if (reminder.reminderType === "oneDay") {
        return {
            reminderLabel: buildResolvedReminderLabel(reminder, people, relationships, today, links),
            reminderRecipient: person?.name ?? reminder.personName,
            textActionTarget: "Not available",
            ecardTarget: first,
            coffeeEligible: false,
            giftEligible: true,
            notificationTitle: buildReminderNotification(reminder, today, undefined, people, relationships)?.title ?? "",
            notificationBody: buildReminderNotification(reminder, today, undefined, people, relationships)?.body ?? "",
        };
    }
    return {
        reminderLabel: buildResolvedReminderLabel(reminder, people, relationships, today, links),
        reminderRecipient: person?.name ?? reminder.personName,
        textActionTarget: first,
        ecardTarget: first,
        coffeeEligible: true,
        giftEligible: false,
        notificationTitle: buildReminderNotification(reminder, today, undefined, people, relationships)?.title ?? "",
        notificationBody: buildReminderNotification(reminder, today, undefined, people, relationships)?.body ?? "",
    };
}
const today = new Date(2026, 6, 8);
const notificationBody = "Don’t forget to send a quick message or plan something thoughtful.";
const scenarios = [
    {
        name: "Direct friend birthday",
        people: [
            person("friend-ryan", "Ryan", {
                phone: "+14155550100",
                moments: [{ id: "b1", type: "birthday", label: "Birthday", date: "1990-07-08", recurring: true }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "friend-ryan",
            personName: "Ryan",
            momentType: "birthday",
            label: "Ryan's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Ryan's birthday today",
            reminderRecipient: "Ryan",
            textActionTarget: "Ryan",
            ecardTarget: "Ryan",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "Ryan's birthday today",
            notificationBody,
        },
    },
    {
        name: "My child's birthday",
        people: [
            person("me-alex", "Alex", {
                phone: "+14155550101",
                children: [{ id: "sam", name: "Sam", birthday: "2019-07-08" }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "me-alex",
            personName: "Alex",
            momentType: "childBirthday",
            label: "Sam turns 7 today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Sam turns 7 today",
            reminderRecipient: "Alex",
            textActionTarget: "Alex about Sam",
            ecardTarget: "Alex about Sam",
            coffeeEligible: false,
            giftEligible: false,
            notificationTitle: "Sam turns 7 today",
            notificationBody,
        },
    },
    {
        name: "Friend's child's birthday",
        people: [
            person("ashley", "Ashley", {
                phone: "+14155550102",
                children: [{ id: "jane", name: "Jane", birthday: "2019-07-08" }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "ashley",
            personName: "Ashley",
            momentType: "childBirthday",
            label: "Jane turns 7 today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Jane turns 7 today",
            reminderRecipient: "Ashley",
            textActionTarget: "Ashley about Jane",
            ecardTarget: "Ashley about Jane",
            coffeeEligible: false,
            giftEligible: false,
            notificationTitle: "Jane turns 7 today",
            notificationBody,
        },
    },
    {
        name: "Parent birthday",
        people: [
            person("mom", "Mom", {
                phone: "+14155550103",
                parentRole: "mother",
                moments: [{ id: "b2", type: "birthday", label: "Birthday", date: "1960-07-08", recurring: true }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "mom",
            personName: "Mom",
            momentType: "birthday",
            label: "Mom's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Mom's birthday today",
            reminderRecipient: "Mom",
            textActionTarget: "Mom",
            ecardTarget: "Mom",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "Mom's birthday today",
            notificationBody,
        },
    },
    {
        name: "Partner birthday",
        people: [
            person("j", "J", { partnerId: "ben" }),
            person("ben", "Ben", {
                phone: "+14155550104",
                partnerId: "j",
                moments: [{ id: "b3", type: "birthday", label: "Birthday", date: "1988-07-08", recurring: true }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "ben",
            personName: "Ben",
            momentType: "birthday",
            label: "Ben's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Ben's birthday today",
            reminderRecipient: "Ben",
            textActionTarget: "Ben",
            ecardTarget: "Ben",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "Ben's birthday today",
            notificationBody,
        },
    },
    {
        name: "Anniversary",
        people: [
            person("j-anni", "J", {
                phone: "+14155550105",
                partnerId: "ben-anni",
                anniversary: "07-08",
            }),
            person("ben-anni", "Ben", { partnerId: "j-anni" }),
        ],
        relationships: [],
        reminder: {
            personId: "j-anni",
            personName: "J",
            momentType: "anniversary",
            label: "J's anniversary today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "J & Ben anniversary today",
            reminderRecipient: "J",
            textActionTarget: "J",
            ecardTarget: "J",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "J & Ben anniversary today",
            notificationBody,
        },
    },
    {
        name: "Standalone person with no relationship",
        people: [
            person("taylor", "Taylor", {
                phone: "+14155550106",
                moments: [{ id: "b4", type: "birthday", label: "Birthday", date: "1992-07-08", recurring: true }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "taylor",
            personName: "Taylor",
            momentType: "birthday",
            label: "Taylor's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Taylor's birthday today",
            reminderRecipient: "Taylor",
            textActionTarget: "Taylor",
            ecardTarget: "Taylor",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "Taylor's birthday today",
            notificationBody,
        },
    },
    {
        name: "Embedded legacy child",
        people: [
            person("legacy-parent", "Sarah", {
                children: [
                    {
                        id: "anthony",
                        name: "Anthony",
                        birthday: "2019-07-08",
                        parents: [{ name: "Jessica", phone: "+14155550107" }],
                    },
                ],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "legacy-parent",
            personName: "Sarah",
            momentType: "childBirthday",
            label: "Anthony turns 7 today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Anthony turns 7 today",
            reminderRecipient: "Jessica",
            textActionTarget: "Jessica about Anthony",
            ecardTarget: "Jessica about Anthony",
            coffeeEligible: false,
            giftEligible: false,
            notificationTitle: "Anthony turns 7 today",
            notificationBody,
        },
    },
    {
        name: "V2 graph child",
        people: [
            person("ashley-graph", "Ashley", { phone: "+14155550108" }),
            person("jane-graph", "Jane", {
                phone: "+14155550109",
                moments: [{ id: "b5", type: "birthday", label: "Birthday", date: "2019-07-08", recurring: true }],
            }),
        ],
        relationships: [{ id: "rel-child", fromId: "ashley-graph", toId: "jane-graph", type: "child" }],
        reminder: {
            personId: "jane-graph",
            personName: "Jane",
            momentType: "birthday",
            label: "Jane's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Jane turns 7 today",
            reminderRecipient: "Ashley",
            textActionTarget: "Ashley about Jane",
            ecardTarget: "Ashley about Jane",
            coffeeEligible: false,
            giftEligible: false,
            notificationTitle: "Jane turns 7 today",
            notificationBody,
        },
    },
    {
        name: "Person with unknown relationship context",
        people: [
            person("morgan", "Morgan", {
                phone: "+14155550110",
                moments: [{ id: "b6", type: "birthday", label: "Birthday", date: "1995-07-08", recurring: true }],
            }),
        ],
        relationships: [],
        reminder: {
            personId: "morgan",
            personName: "Morgan",
            momentType: "birthday",
            label: "Morgan's birthday today",
            date: "2026-07-08",
            triggerDate: "2026-07-08",
            eventDate: "2026-07-08",
            reminderType: "dayOf",
        },
        expect: {
            reminderLabel: "Morgan's birthday today",
            reminderRecipient: "Morgan",
            textActionTarget: "Morgan",
            ecardTarget: "Morgan",
            coffeeEligible: true,
            giftEligible: false,
            notificationTitle: "Morgan's birthday today",
            notificationBody,
        },
    },
];
export function runPhase2ReminderVerification() {
    const lines = [];
    for (const scenario of scenarios) {
        const summary = summarizeActions(scenario.reminder, scenario.people, scenario.relationships, today);
        assertEqual(`${scenario.name} / reminderLabel`, summary.reminderLabel, scenario.expect.reminderLabel);
        assertEqual(`${scenario.name} / reminderRecipient`, summary.reminderRecipient, scenario.expect.reminderRecipient);
        assertEqual(`${scenario.name} / textActionTarget`, summary.textActionTarget, scenario.expect.textActionTarget);
        assertEqual(`${scenario.name} / ecardTarget`, summary.ecardTarget, scenario.expect.ecardTarget);
        assertEqual(`${scenario.name} / coffeeEligible`, summary.coffeeEligible, scenario.expect.coffeeEligible);
        assertEqual(`${scenario.name} / giftEligible`, summary.giftEligible, scenario.expect.giftEligible);
        assertEqual(`${scenario.name} / notificationTitle`, summary.notificationTitle, scenario.expect.notificationTitle);
        assertEqual(`${scenario.name} / notificationBody`, summary.notificationBody, scenario.expect.notificationBody);
        lines.push(`PASS ${scenario.name}`);
        lines.push(`  Reminder wording: ${summary.reminderLabel}`);
        lines.push(`  Reminder recipient: ${summary.reminderRecipient}`);
        lines.push(`  Text action target: ${summary.textActionTarget}`);
        lines.push(`  eCard target: ${summary.ecardTarget}`);
        lines.push(`  Coffee eligible: ${String(summary.coffeeEligible)}`);
        lines.push(`  Gift eligible: ${String(summary.giftEligible)}`);
        lines.push(`  Notification: ${summary.notificationTitle} / ${summary.notificationBody}`);
    }
    return lines.join("\n");
}
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv?.[1] ?? ""}`) {
    try {
        console.log(runPhase2ReminderVerification());
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
