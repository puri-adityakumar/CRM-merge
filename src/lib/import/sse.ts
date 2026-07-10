/**
 * Server-Sent Events helpers for the CSV import stream endpoint.
 * Pure string formatting — no HTTP / no I/O.
 */

/** Named SSE event types used by POST /api/import/stream. */
export type ImportSseEventName = "progress" | "complete" | "error";

/**
 * Format one SSE message block.
 * Spec: optional `event:` line, `data:` line(s), blank line terminator.
 */
export function formatSseEvent(
  event: ImportSseEventName,
  data: unknown,
): string {
  const payload = JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

/**
 * Parse a chunk of SSE text into discrete events.
 * Tolerates partial lines by returning leftovers in `rest`.
 */
export function parseSseChunk(
  buffer: string,
): {
  events: Array<{ event: string; data: string }>;
  rest: string;
} {
  const events: Array<{ event: string; data: string }> = [];
  // SSE events are separated by a blank line
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const block of parts) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }

  return { events, rest };
}
