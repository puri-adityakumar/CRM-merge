import { describe, it, expect } from "vitest";
import {
  CLIENT_MAX_UPLOAD_BYTES,
  isCsvFile,
  validateUploadFile,
} from "./file-validation";
import { DEFAULT_MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "@/config/constants";

describe("CLIENT_MAX_UPLOAD_BYTES", () => {
  it("matches the server default of 5 MiB", () => {
    expect(CLIENT_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(CLIENT_MAX_UPLOAD_BYTES).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(CLIENT_MAX_UPLOAD_BYTES).toBe(MAX_UPLOAD_BYTES);
  });
});

describe("isCsvFile", () => {
  it("accepts .csv extension (case-insensitive)", () => {
    expect(isCsvFile({ name: "leads.csv" })).toBe(true);
    expect(isCsvFile({ name: "LEADS.CSV" })).toBe(true);
    expect(isCsvFile({ name: "data.Csv" })).toBe(true);
  });

  it("accepts text/csv MIME type even without .csv extension", () => {
    expect(isCsvFile({ name: "export", type: "text/csv" })).toBe(true);
    expect(isCsvFile({ name: "blob", type: "text/csv" })).toBe(true);
  });

  it("accepts when both extension and MIME match", () => {
    expect(isCsvFile({ name: "leads.csv", type: "text/csv" })).toBe(true);
  });

  it("rejects non-CSV extensions and MIME types", () => {
    expect(isCsvFile({ name: "photo.png" })).toBe(false);
    expect(isCsvFile({ name: "doc.pdf", type: "application/pdf" })).toBe(false);
    expect(isCsvFile({ name: "sheet.xlsx" })).toBe(false);
    expect(isCsvFile({ name: "data.txt" })).toBe(false);
    expect(isCsvFile({ name: "csv" })).toBe(false);
    expect(isCsvFile({ name: "file.csv.bak" })).toBe(false);
  });

  it("rejects empty name without text/csv MIME", () => {
    expect(isCsvFile({ name: "" })).toBe(false);
    expect(isCsvFile({ name: "", type: "application/octet-stream" })).toBe(
      false,
    );
  });
});

describe("validateUploadFile", () => {
  const csvOk = { name: "leads.csv", size: 100, type: "text/csv" };

  it("returns ok for a valid CSV under the size limit", () => {
    expect(validateUploadFile(csvOk)).toEqual({ ok: true });
  });

  it("returns NOT_CSV for non-CSV files", () => {
    const result = validateUploadFile({
      name: "photo.png",
      size: 100,
      type: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_CSV");
      expect(result.message).toMatch(/csv/i);
    }
  });

  it("returns FILE_TOO_LARGE when size exceeds default max", () => {
    const result = validateUploadFile({
      name: "big.csv",
      size: CLIENT_MAX_UPLOAD_BYTES + 1,
      type: "text/csv",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_TOO_LARGE");
      expect(result.message).toMatch(/large|size|limit|max/i);
    }
  });

  it("allows size exactly equal to the max (inclusive)", () => {
    expect(
      validateUploadFile({
        name: "edge.csv",
        size: CLIENT_MAX_UPLOAD_BYTES,
        type: "text/csv",
      }),
    ).toEqual({ ok: true });
  });

  it("respects a custom maxBytes argument", () => {
    const maxBytes = 50;
    expect(
      validateUploadFile({ name: "ok.csv", size: 50, type: "text/csv" }, maxBytes),
    ).toEqual({ ok: true });

    const tooBig = validateUploadFile(
      { name: "ok.csv", size: 51, type: "text/csv" },
      maxBytes,
    );
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) {
      expect(tooBig.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("prefers NOT_CSV over FILE_TOO_LARGE when both fail", () => {
    const result = validateUploadFile({
      name: "huge.png",
      size: CLIENT_MAX_UPLOAD_BYTES + 1,
      type: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_CSV");
    }
  });

  it("accepts CSV by MIME when extension is missing", () => {
    expect(
      validateUploadFile({
        name: "export",
        size: 10,
        type: "text/csv",
      }),
    ).toEqual({ ok: true });
  });
});
