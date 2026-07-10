import { describe, it, expect } from "vitest";
import { chunk } from "./batch";

describe("chunk", () => {
  it("splits an array into chunks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("produces no empty trailing array when length is an exact multiple", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("returns a single chunk for a one-element array", () => {
    expect(chunk([1], 3)).toEqual([[1]]);
  });

  it("returns [] for an empty array (no batches, not [[]])", () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it("returns a single chunk when batch size is larger than the array", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("splits every element into its own batch when batch size is 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("preserves original order within and across batches", () => {
    const input = [10, 20, 30, 40, 50, 60];
    const result = chunk(input, 2);
    expect(result.flat()).toEqual(input);
  });

  it("works with arrays of objects (the real use case: CSV rows)", () => {
    const rows: Record<string, unknown>[] = [
      { name: "Ada", age: 36 },
      { name: "Linus", age: 54 },
      { name: "Grace", age: 85 },
    ];
    const result = chunk(rows, 2);
    expect(result).toEqual([
      [{ name: "Ada", age: 36 }, { name: "Linus", age: 54 }],
      [{ name: "Grace", age: 85 }],
    ]);
  });

  it("throws a RangeError when batch size is 0", () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow(RangeError);
  });

  it("throws a RangeError when batch size is negative", () => {
    expect(() => chunk([1, 2, 3], -1)).toThrow(RangeError);
  });

  it("throws a TypeError when input is not an array", () => {
    expect(() => chunk(null as unknown as unknown[], 2)).toThrow(TypeError);
  });
});
