import { open, readFile } from "node:fs/promises";

/** Only the end of a transcript is read to find its last turn. */
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;

/** A main-conversation turn of a Claude Code transcript. */
export interface Turn {
  timestamp: string;
  /** Tokens of the prompt sent for this turn */
  prompt: number;
  /** Prompt plus answer: the size of the conversation after this turn */
  size: number;
}

/**
 * Size in tokens of a conversation: the prompt of its last assistant turn
 * plus that turn's answer, read from the transcript's usage data. Null when
 * the transcript has none.
 */
export async function conversationSize(
  transcriptPath: string
): Promise<number | null> {
  let tail: string;
  try {
    const handle = await open(transcriptPath, "r");
    try {
      const { size } = await handle.stat();
      const length = Math.min(size, TRANSCRIPT_TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, size - length);
      tail = buffer.toString("utf-8");
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }

  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const turn = parseTurn(lines[i]);
    if (turn) return turn.size;
  }
  return null;
}

/** Every main-conversation turn of a transcript, oldest first. */
export async function transcriptTurns(
  transcriptPath: string
): Promise<Turn[]> {
  let raw: string;
  try {
    raw = await readFile(transcriptPath, "utf-8");
  } catch {
    return [];
  }
  const turns: Turn[] = [];
  for (const line of raw.split("\n")) {
    const turn = parseTurn(line);
    if (turn) turns.push(turn);
  }
  return turns;
}

/** The turn recorded by a transcript line, if it is a main-conversation answer. */
function parseTurn(line: string): Turn | null {
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    // Blank, or cut by the tail read
    return null;
  }
  if (typeof entry !== "object" || entry === null) return null;

  const record = entry as {
    type?: unknown;
    isSidechain?: unknown;
    timestamp?: unknown;
    message?: {
      model?: unknown;
      usage?: Record<string, unknown>;
    };
  };
  // Subagent turns have their own, smaller context
  if (record.type !== "assistant" || record.isSidechain === true) return null;
  // Messages Claude Code writes itself, such as errors, carry no real usage
  if (record.message?.model === "<synthetic>") return null;

  const usage = record.message?.usage;
  if (!usage || typeof usage.input_tokens !== "number") return null;
  const count = (value: unknown) => (typeof value === "number" ? value : 0);
  const prompt =
    usage.input_tokens +
    count(usage.cache_creation_input_tokens) +
    count(usage.cache_read_input_tokens);
  const size = prompt + count(usage.output_tokens);
  if (size === 0) return null;

  return {
    timestamp: typeof record.timestamp === "string" ? record.timestamp : "",
    prompt,
    size,
  };
}
