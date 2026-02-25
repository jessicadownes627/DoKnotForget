export type Moment = {
  id: string;
  personId: string;
  type: "birthday" | "holiday" | "life";
  date: string; // ISO string
  acknowledged: boolean;
  reminderAt?: string; // ISO string
};
