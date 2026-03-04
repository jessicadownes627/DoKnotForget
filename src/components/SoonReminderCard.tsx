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
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const sep = isIOS ? "&" : "?";
  return `sms:${cleanedPhone}${sep}body=${encodedBody}`;
}

export function openSmsComposer(phone?: string, message?: string): void {
  const cleanedPhone = (phone ?? "").trim();
  if (!cleanedPhone) return;
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
  const trimmed = eventText.trim();
  const parts = trimmed.split("·").map((p) => p.trim()).filter(Boolean);
  const dateLine = parts[0] ?? trimmed;
  const label = parts.length > 1 ? parts.slice(1).join(" · ") : "";
  const title = label ? `${personName}’s ${label}` : personName;

  return (
    <div className="soon-card">
      <div className="soon-event">{dateLine}</div>
      <h3 className="soon-name">{title}</h3>
      <button
        className="soon-button"
        disabled={!phone}
        title={!phone ? "Add a phone number to text them." : undefined}
        onClick={() => openSmsComposer(phone, prefilledMessage)}
      >
        Text {contactLabel}
      </button>
    </div>
  );
}
