import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });

  it("returns 200 with ok/status healthy", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("healthy");
  });

  it("reports llmConfigured false when key is unset", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await GET();
    const body = await res.json();
    expect(body.llmConfigured).toBe(false);
  });

  it("reports llmConfigured true when key is set (boolean only)", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test-secret-should-not-leak";
    const res = await GET();
    const body = await res.json();
    expect(body.llmConfigured).toBe(true);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toMatch(/OPENROUTER/i);
  });
});
