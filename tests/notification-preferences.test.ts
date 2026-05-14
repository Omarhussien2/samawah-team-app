import { describe, expect, it } from "vitest";
import {
  defaultNotificationPreferences,
  shouldSendImportantEmail,
} from "../lib/notifications/preferences";

describe("notification preferences", () => {
  it("keeps email limited to important notifications by default", () => {
    expect(defaultNotificationPreferences.email_enabled).toBe(true);
    expect(defaultNotificationPreferences.important_email_only).toBe(true);
    expect(shouldSendImportantEmail(defaultNotificationPreferences, false)).toBe(false);
    expect(shouldSendImportantEmail(defaultNotificationPreferences, true)).toBe(true);
  });

  it("does not send email when email is disabled", () => {
    expect(
      shouldSendImportantEmail(
        { email_enabled: false, important_email_only: false },
        true
      )
    ).toBe(false);
  });
});
