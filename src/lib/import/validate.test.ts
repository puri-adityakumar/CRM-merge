import { describe, it, expect } from "vitest";
import {
  checkUploadSize,
  classifyImportInput,
  type UploadSizeResult,
  type ImportInputKind,
} from "./validate";

describe("checkUploadSize", () => {
  const max = 5 * 1024 * 1024;

  it("returns ok when byteLength is under the limit", () => {
    const result: UploadSizeResult = checkUploadSize(1024, max);
    expect(result).toEqual({ ok: true });
  });

  it("returns ok when byteLength equals the limit", () => {
    expect(checkUploadSize(max, max)).toEqual({ ok: true });
  });

  it("returns too_large when byteLength exceeds the limit", () => {
    const result = checkUploadSize(max + 1, max);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("returns ok for zero-length payloads (empty is not size-related)", () => {
    expect(checkUploadSize(0, max)).toEqual({ ok: true });
  });
});

describe("classifyImportInput", () => {
  it("classifies missing file (null bytes)", () => {
    const kind: ImportInputKind = classifyImportInput({
      hasFile: false,
      rowCount: 0,
    });
    expect(kind).toBe("missing_file");
  });

  it("classifies missing file when hasFile is false even if rowCount > 0", () => {
    expect(
      classifyImportInput({ hasFile: false, rowCount: 3 }),
    ).toBe("missing_file");
  });

  it("classifies empty rows when file present but zero data rows", () => {
    expect(
      classifyImportInput({ hasFile: true, rowCount: 0 }),
    ).toBe("empty_rows");
  });

  it("classifies ok when file present and rows exist", () => {
    expect(
      classifyImportInput({ hasFile: true, rowCount: 1 }),
    ).toBe("ok");
  });
});
