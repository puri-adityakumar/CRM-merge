/**
 * Splits an array into smaller batches (chunks) of the given size.
 *
 * Used by the CSV importer to split parsed rows before sending them to an LLM
 * for extraction, keeping each request within a manageable size.
 *
 * @param arr       The array to chunk.
 * @param batchSize The desired size of each batch. Must be a positive integer.
 * @returns An array of batches. Empty input yields `[]` (never `[[]]`). The
 *          last batch may be smaller than `batchSize`.
 * @throws {TypeError}  If `arr` is not an array.
 * @throws {RangeError} If `batchSize` is less than 1.
 */
export function chunk<T>(arr: T[], batchSize: number): T[][] {
  if (!Array.isArray(arr)) {
    throw new TypeError("chunk(): expected an array as the first argument");
  }

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError(
      `chunk(): batchSize must be a positive integer, received ${batchSize}`,
    );
  }

  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    result.push(arr.slice(i, i + batchSize));
  }
  return result;
}
