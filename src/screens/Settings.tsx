import { LocalNotifications } from "@capacitor/local-notifications";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../appState";
import { getUpcomingReminders } from "../engine/reminderEngine";
import { useNavigate } from "../router";
import {
  cancelScheduledReminderNotifications,
  configureReminderNotifications,
  isNativeNotificationsSupported,
  scheduleReminderNotifications,
} from "../utils/notificationScheduler";

function formatTimeValue(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function Settings() {
  const navigate = useNavigate();
  const { people, userSettings, updateUserSettings } = useAppState();
  const [notificationStatus, setNotificationStatus] = useState<"on" | "off">("off");

  const reminderTimeValue = useMemo(
    () => formatTimeValue(userSettings.reminderHour, userSettings.reminderMinute),
    [userSettings.reminderHour, userSettings.reminderMinute]
  );

  useEffect(() => {
    let isMounted = true;

    async function refreshNotificationStatus() {
      if (!isNativeNotificationsSupported()) {
        if (isMounted) setNotificationStatus("off");
        return;
      }

      const permission = await LocalNotifications.checkPermissions();
      if (isMounted) {
        setNotificationStatus(permission.display === "granted" ? "on" : "off");
      }
    }

    void refreshNotificationStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleReminderTimeChange(value: string) {
    const [hourValue, minuteValue] = value.split(":");
    const nextHour = Number(hourValue);
    const nextMinute = Number(minuteValue);

    if (!Number.isInteger(nextHour) || !Number.isInteger(nextMinute)) return;
    if (nextHour === userSettings.reminderHour && nextMinute === userSettings.reminderMinute) return;

    const nextSettings = {
      notificationsEnabled: userSettings.notificationsEnabled,
      reminderHour: nextHour,
      reminderMinute: nextMinute,
    };

    updateUserSettings(nextSettings);

    if (!isNativeNotificationsSupported()) return;

    await configureReminderNotifications();
    const permission = await LocalNotifications.checkPermissions();
    setNotificationStatus(permission.display === "granted" ? "on" : "off");
    if (permission.display !== "granted") return;

    const reminders = getUpcomingReminders(people, startOfToday());
    await scheduleReminderNotifications(reminders, new Date(), nextSettings);
  }

  async function handleNotificationsToggle(enabled: boolean) {
    updateUserSettings({ notificationsEnabled: enabled });

    if (!isNativeNotificationsSupported()) {
      setNotificationStatus(enabled ? "on" : "off");
      return;
    }

    await configureReminderNotifications();

    if (!enabled) {
      await cancelScheduledReminderNotifications();
      setNotificationStatus("off");
      return;
    }

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      setNotificationStatus(requested.display === "granted" ? "on" : "off");
      if (requested.display !== "granted") {
        updateUserSettings({ notificationsEnabled: false });
        return;
      }
    } else {
      setNotificationStatus("on");
    }

    const reminders = getUpcomingReminders(people, startOfToday());
    await scheduleReminderNotifications(reminders, new Date(), {
      ...userSettings,
      notificationsEnabled: true,
    });
  }

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          padding: "64px var(--space-16) var(--space-24)",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/home")}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontFamily: "var(--font-sans)",
          }}
        >
          Back
        </button>

        <h1
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 600,
            letterSpacing: "-0.03em",
          }}
        >
          Settings
        </h1>

        <section
          style={{
            marginTop: "24px",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            background: "var(--card)",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--ink)",
                fontFamily: "var(--font-sans)",
              }}
            >
              Notifications
            </div>
            <label
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={userSettings.notificationsEnabled}
                onChange={(event) => {
                  void handleNotificationsToggle(event.target.checked);
                }}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: 0,
                  height: 0,
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  width: "48px",
                  height: "30px",
                  borderRadius: "999px",
                  background: userSettings.notificationsEnabled ? "var(--ink)" : "rgba(27,42,65,0.18)",
                  position: "relative",
                  transition: "background 160ms ease",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: userSettings.notificationsEnabled ? "21px" : "3px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "999px",
                    background: "#fff",
                    transition: "left 160ms ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  }}
                />
              </span>
            </label>
          </div>
          <label
            htmlFor="reminder-time"
            style={{
              display: "block",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
              marginTop: "16px",
            }}
          >
            Reminder Time
          </label>
          <div
            style={{
              marginTop: "8px",
              color: "var(--muted)",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              fontFamily: "var(--font-sans)",
            }}
          >
            Choose the time of day when local reminder notifications should fire.
          </div>
          <div
            style={{
              marginTop: "8px",
              color: "var(--muted)",
              fontSize: "0.9rem",
              lineHeight: 1.5,
              fontFamily: "var(--font-sans)",
            }}
          >
            {notificationStatus === "on" ? "Notifications: On" : "Notifications are off — enable in Settings"}
          </div>
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <input
              id="reminder-time"
              type="time"
              value={reminderTimeValue}
              disabled={!userSettings.notificationsEnabled}
              onChange={(event) => {
                void handleReminderTimeChange(event.target.value);
              }}
              style={{
                display: "block",
                minWidth: "160px",
                padding: "0.85rem 1.5rem",
                borderRadius: "999px",
                border: "1px solid var(--border-strong)",
                background: "rgba(255,255,255,0.82)",
                color: "var(--ink)",
                fontSize: "1rem",
                fontFamily: "var(--font-sans)",
                textAlign: "center",
                boxSizing: "border-box",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                opacity: userSettings.notificationsEnabled ? 1 : 0.5,
                cursor: userSettings.notificationsEnabled ? "pointer" : "not-allowed",
              }}
            />
          </div>
        </section>

        <div
          style={{
            marginTop: "48px",
            textAlign: "center",
            color: "rgba(27, 42, 65, 0.58)",
            fontSize: "0.9rem",
            fontFamily: "var(--font-sans)",
          }}
        >
          Your people. On time.
        </div>
      </div>
    </div>
  );
}
