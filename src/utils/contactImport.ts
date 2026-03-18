import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";

export function getCapacitorContactsPlugin(): any | null {
  if (Contacts) return Contacts;
  const cap = (window as any)?.Capacitor;
  const plugins = cap?.Plugins;
  if (!plugins) return null;
  return plugins.Contacts || plugins.CapacitorContacts || plugins.Contact || null;
}

export function isContactImportSupported() {
  return typeof window !== "undefined" && Capacitor.getPlatform() !== "web" && Boolean(getCapacitorContactsPlugin());
}
