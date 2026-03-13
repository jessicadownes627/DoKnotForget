export type CareEventType = "text" | "ecard" | "gift" | "coffee" | "reminderComplete";

export type CareEvent = {
  id: string;
  personId: string;
  type: CareEventType;
  timestamp: string;
  note?: string;
};
