import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock extract at the module boundary used by the route's default path.
// The route injects extractLeads explicitly; we stub the module so handlers
// never hit a live LLM in unit tests.
vi.mock("@/lib/ai/extract", () => ({
  extractLeads: vi.fn(async (rows: Record<string, string>[]) => ({
    imported: rows.map((r) => ({
      created_at: "",
      name: r.name ?? r.Name ?? "",
      email: r.email ?? r.Email ?? "",
      country_code: "",
      mobile_without_country_code: "",
      company: "",
      city: "",
      state: "",
      country: "",
      lead_owner: "",
      crm_status: "",
      crm_note: "",
      data_source: "",
      possession_time: "",
      description: "",
    })),
    skipped: [],
    stats: {
      totalRows: rows.length,
      totalImported: rows.length,
      totalSkipped: 0,
      batchesProcessed: 1,
      batchesFailed: 0,
    },
  })),
}));

import { POST } from "./route";

function multipartRequest(parts: {
  fieldName?: string;
  filename?: string;
  content: string;
  contentType?: string;
} | null): Request {
  const form = new FormData();
  if (parts) {
    const blob = new Blob([parts.content], {
      type: parts.contentType ?? "text/csv",
    });
    form.append(
      parts.fieldName ?? "file",
      blob,
      parts.filename ?? "leads.csv",
    );
  }
  return new Request("http://localhost/api/import", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 MISSING_FILE when no file field", async () => {
    const res = await POST(multipartRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("MISSING_FILE");
  });

  it("returns 422 EMPTY_CSV for headers-only CSV", async () => {
    const res = await POST(
      multipartRequest({ content: "name,email\n" }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("EMPTY_CSV");
  });

  it("returns 400 INVALID_CSV for empty payload file", async () => {
    const res = await POST(multipartRequest({ content: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_CSV");
  });

  it("returns 200 with imported/skipped/stats on valid CSV", async () => {
    const res = await POST(
      multipartRequest({
        content: "name,email\nAda,ada@example.com\n",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("imported");
    expect(body).toHaveProperty("skipped");
    expect(body).toHaveProperty("stats");
    expect(body.imported).toHaveLength(1);
    expect(body.stats.totalRows).toBe(1);
  });

  it("returns 413 FILE_TOO_LARGE when over MAX_UPLOAD_BYTES", async () => {
    const prev = process.env.MAX_UPLOAD_BYTES;
    process.env.MAX_UPLOAD_BYTES = "50";
    try {
      // Need to re-import getMaxUploadBytes behavior — it reads env at call time,
      // so this works without reloading the module.
      const big = "x".repeat(100);
      const res = await POST(
        multipartRequest({ content: `name,email\n${big},a@b.com\n` }),
      );
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.code).toBe("FILE_TOO_LARGE");
    } finally {
      if (prev === undefined) {
        delete process.env.MAX_UPLOAD_BYTES;
      } else {
        process.env.MAX_UPLOAD_BYTES = prev;
      }
    }
  });
});
