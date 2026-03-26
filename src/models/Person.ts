export type Moment = {
  id: string;
  type: "birthday" | "anniversary" | "custom";
  label: string;
  date: string;
  recurring: boolean;
  category?: "sensitive";
};

export type ChildSchoolEventType =
  | "firstDay"
  | "kGrad"
  | "5thMoveUp"
  | "8thGrad"
  | "hsGrad"
  | "communion"
  | "confirmation"
  | "barMitzvah"
  | "batMitzvah"
  | "custom";

export type ChildSchoolEvent = {
  type: ChildSchoolEventType;
  date: string; // YYYY-MM-DD
  label?: string;
};

export type ChildParentContact = {
  id?: string;
  name?: string;
  phone?: string;
};

export type Child = {
  id: string;
  name?: string;
  birthday?: string | null; // YYYY-MM-DD (use 0000-MM-DD if year unknown)
  // Back-compat: older records used `birthdate`.
  birthdate?: string | null;
  parents?: ChildParentContact[];
  schoolEvents?: ChildSchoolEvent[];
};

export type PersonHolidayId =
  | "christmas"
  | "easterWestern"
  | "easterOrthodox"
  | "hanukkah"
  | "eidAlFitr"
  | "diwali";

export type Person = {
  id: string;
  name: string;
  phone?: string;
  moments: Moment[];
  giftHistory?: { type: string; date: string; timestamp?: string }[];
  isMother?: boolean | null; // null/undefined = unknown, true/false = answered
  isFather?: boolean | null; // null/undefined = unknown, true/false = answered
  partnerId?: string | null; // partnered person id
  anniversary?: string | null; // MM-DD
  hasKids?: boolean;
  parentRole?: "mother" | "father" | "parent";
  selectedHolidays?: PersonHolidayId[];
  // Legacy fields kept for back-compat with existing local data.
  religionCulture?: Array<"christian" | "orthodox" | "jewish" | "muslim" | "none">;
  religionTag?: string; // legacy free-text
  holidayPrefs?: { mothersDay?: boolean; fathersDay?: boolean };
  importantDates?: Moment[];
  sensitiveMoments?: Moment[];
  children?: Child[];
};
