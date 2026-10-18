/** How the Claude Code hooks reach Claude when a summary needs saving. */
export type ReminderMode = "nudge" | "warn" | "off";

/**
 * Options of the Claude Code hooks, read from the server's environment. The
 * plugin fills these variables from the options the user sets in /config.
 */
export interface HookSettings {
  /** nudge: Claude saves the summary itself; warn: only tell the user; off */
  reminders: ReminderMode;
  /** Conversation growth, in tokens, between two reminders */
  reminderTokens: number;
  /** Share of the context window (percent) that triggers a last reminder */
  contextThreshold: number;
  /** Ask Claude to save the summary right after a compaction lost it */
  compactSummary: boolean;
  /** Answer tm:tree and tm:stats without sending them to Claude */
  instantCommands: boolean;
  /** Context window size in tokens, or null to detect it */
  contextWindow: number | null;
}

export const DEFAULT_HOOK_SETTINGS: HookSettings = {
  reminders: "nudge",
  reminderTokens: 50_000,
  contextThreshold: 70,
  compactSummary: true,
  instantCommands: true,
  contextWindow: null,
};

/** Whether the server exposes the tool that the Claude Code hooks call. */
export function hooksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseBoolean(env.THREADMIND_HOOKS) ?? false;
}

export function hookSettings(
  env: NodeJS.ProcessEnv = process.env
): HookSettings {
  const d = DEFAULT_HOOK_SETTINGS;
  const reminders = value(env.THREADMIND_REMINDERS)?.toLowerCase();
  return {
    reminders:
      reminders === "nudge" || reminders === "warn" || reminders === "off"
        ? reminders
        : d.reminders,
    reminderTokens:
      parseNumber(env.THREADMIND_REMINDER_TOKENS, 1_000, 10_000_000) ??
      d.reminderTokens,
    contextThreshold:
      parseNumber(env.THREADMIND_CONTEXT_THRESHOLD, 10, 99) ??
      d.contextThreshold,
    compactSummary:
      parseBoolean(env.THREADMIND_COMPACT_SUMMARY) ?? d.compactSummary,
    instantCommands:
      parseBoolean(env.THREADMIND_INSTANT_COMMANDS) ?? d.instantCommands,
    // 0 stands for "detect"
    contextWindow:
      parseNumber(env.THREADMIND_CONTEXT_WINDOW, 1_000, 100_000_000) ??
      d.contextWindow,
  };
}

/** A set value, ignoring blanks and placeholders Claude Code left unsubstituted. */
function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed && !trimmed.startsWith("${") ? trimmed : undefined;
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  const v = value(raw)?.toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return undefined;
}

function parseNumber(
  raw: string | undefined,
  min: number,
  max: number
): number | undefined {
  const v = value(raw);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
}
