import { describe, it, expect } from "vitest";
import {
  DEFAULT_HOOK_SETTINGS,
  hookSettings,
  hooksEnabled,
} from "../../src/hooks/settings.js";

describe("hook settings", () => {
  it("default to nudging reminders and every helper on", () => {
    expect(hookSettings({})).toEqual(DEFAULT_HOOK_SETTINGS);
    expect(hooksEnabled({})).toBe(false);
  });

  it("read the options the plugin passes to the server", () => {
    expect(
      hookSettings({
        THREADMIND_REMINDERS: "warn",
        THREADMIND_REMINDER_TOKENS: "30000",
        THREADMIND_CONTEXT_THRESHOLD: "80",
        THREADMIND_COMPACT_SUMMARY: "false",
        THREADMIND_INSTANT_COMMANDS: "false",
        THREADMIND_CONTEXT_WINDOW: "1000000",
      })
    ).toEqual({
      reminders: "warn",
      reminderTokens: 30_000,
      contextThreshold: 80,
      compactSummary: false,
      instantCommands: false,
      contextWindow: 1_000_000,
    });
    expect(hooksEnabled({ THREADMIND_HOOKS: "1" })).toBe(true);
  });

  it("fall back to defaults on invalid or unsubstituted values", () => {
    expect(
      hookSettings({
        THREADMIND_REMINDERS: "loud",
        THREADMIND_REMINDER_TOKENS: "${user_config.reminder_tokens}",
        THREADMIND_CONTEXT_THRESHOLD: "150",
        THREADMIND_COMPACT_SUMMARY: "maybe",
        // 0 stands for "detect"
        THREADMIND_CONTEXT_WINDOW: "0",
      })
    ).toEqual(DEFAULT_HOOK_SETTINGS);
  });
});
