export function eventKey(personId: string, momentType: string, eventDate: string) {
  return `${personId}_${momentType}_${eventDate}`;
}
