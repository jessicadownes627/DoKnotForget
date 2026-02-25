export type SoonReminderCardProps = {
  personName: string;
  eventText: string;
  contactLabel: string;
  phone?: string;
  prefilledMessage: string;
};

export function buildSmsUrl(phone?: string, body?: string): string {
  const cleanedPhone = (phone ?? "").trim();
  const encodedBody = encodeURIComponent(body ?? "");
  return `sms:${cleanedPhone}?body=${encodedBody}`;
}

export function openSmsComposer(phone?: string, message?: string): void {
  const smsUrl = buildSmsUrl(phone, message);
  window.location.href = smsUrl;
}

export default function SoonReminderCard({
  personName,
  eventText,
  contactLabel,
  phone,
  prefilledMessage,
}: SoonReminderCardProps) {
  return (
    <div className="soon-card">
      <h3 className="soon-name">{personName}</h3>
      <p className="soon-event">{eventText}</p>
      <button
        className="soon-button"
        onClick={() => openSmsComposer(phone, prefilledMessage)}
      >
        Text {contactLabel}
      </button>
    </div>
  );
}
