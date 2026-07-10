import { describe, it, expect } from "vitest";
import { formatSseEvent, parseSseChunk } from "./sse";

describe("formatSseEvent", () => {
  it("formats progress event with JSON data and trailing blank line", () => {
    const out = formatSseEvent("progress", {
      batchIndex: 0,
      totalBatches: 2,
      processed: 1,
    });
    expect(out).toBe(
      'event: progress\ndata: {"batchIndex":0,"totalBatches":2,"processed":1}\n\n',
    );
  });

  it("formats complete and error event names", () => {
    expect(formatSseEvent("complete", { ok: true })).toContain(
      "event: complete\n",
    );
    expect(formatSseEvent("error", { code: "INVALID_CSV" })).toContain(
      "event: error\n",
    );
  });
});

describe("parseSseChunk", () => {
  it("parses a full progress + complete stream", () => {
    const text =
      formatSseEvent("progress", { processed: 1, totalBatches: 2 }) +
      formatSseEvent("complete", { imported: [], skipped: [], stats: {} });
    const { events, rest } = parseSseChunk(text);
    expect(rest).toBe("");
    expect(events).toHaveLength(2);
    expect(events[0]!.event).toBe("progress");
    expect(JSON.parse(events[0]!.data)).toEqual({
      processed: 1,
      totalBatches: 2,
    });
    expect(events[1]!.event).toBe("complete");
  });

  it("returns incomplete trailing block as rest", () => {
    const { events, rest } = parseSseChunk("event: progress\ndata: {");
    expect(events).toHaveLength(0);
    expect(rest).toContain("data: {");
  });

  it("round-trips format then parse", () => {
    const raw = formatSseEvent("error", {
      error: "Missing file",
      code: "MISSING_FILE",
      status: 400,
    });
    const { events } = parseSseChunk(raw);
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]!.data)).toEqual({
      error: "Missing file",
      code: "MISSING_FILE",
      status: 400,
    });
  });
});
