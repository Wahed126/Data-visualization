// Streaming loader for the alloy dataset.
//
// The raw file is ~223 MB. Reading it with `response.text()` / FileReader
// materializes a single ~450 MB UTF-16 JavaScript string plus 324k parsed row
// objects — enough to crash low-memory machines. Instead the file is consumed
// as a byte stream, decoded chunk-by-chunk, and parsed line-by-line directly
// into one flat Float32Array (324,632 rows x 70 columns ≈ 91 MB). No full-file
// string and no per-row objects are ever created for the full dataset.

const INITIAL_ROW_CAPACITY = 350000;

// Number of rows drawn as individual marks (PCP polylines, embedding dots).
// All statistics (extents, density bins, PCA, filter counts) always use every
// row; beyond ~10k rendered marks the pixels saturate and add no information.
export const DISPLAY_SAMPLE_SIZE = 10000;

const parseHeader = (line) => {
  // Zenodo TXT files carry trailing tabs after the last real column
  return line.replace(/\t+$/g, "").split("\t").map((c) => c.trim());
};

/**
 * Stream-parse a tab-separated alloy dataset into a columnar typed-array table.
 *
 * @param {ReadableStream} byteStream - raw byte stream (fetch body or File.stream())
 * @param {number} totalBytes - for progress reporting (0 if unknown)
 * @param {(fraction: number) => void} onProgress
 * @returns {Promise<{columns: string[], matrix: Float32Array, rowCount: number, stats: {min: number[], max: number[], finiteCount: number[]}}>}
 */
export async function streamParseTable(byteStream, totalBytes, onProgress) {
  const reader = byteStream.getReader();
  // latin-1: the headers contain 0xB0 degree signs that are invalid UTF-8
  const decoder = new TextDecoder("latin1");

  let leftover = "";
  let columns = null;
  let columnCount = 0;
  let matrix = null;
  let capacity = INITIAL_ROW_CAPACITY;
  let rowCount = 0;
  let bytesRead = 0;
  let lastReported = 0;

  const growIfNeeded = () => {
    if (rowCount < capacity) return;
    capacity = Math.floor(capacity * 1.5);
    const next = new Float32Array(capacity * columnCount);
    next.set(matrix);
    matrix = next;
  };

  const parseLine = (line) => {
    if (line.length === 0) return;
    if (!columns) {
      columns = parseHeader(line);
      columnCount = columns.length;
      matrix = new Float32Array(capacity * columnCount);
      return;
    }
    growIfNeeded();
    const cells = line.split("\t");
    const offset = rowCount * columnCount;
    for (let j = 0; j < columnCount; j++) {
      const raw = cells[j];
      let value = raw === undefined || raw === "" ? NaN : Number(raw);
      // A missing phase fraction means the phase did not form
      if (!Number.isFinite(value) && columns[j].startsWith("Vf_")) {
        value = 0;
      }
      matrix[offset + j] = value;
    }
    rowCount += 1;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    const text = leftover + decoder.decode(value, { stream: true });
    const lines = text.split("\n");
    leftover = lines.pop();
    for (const line of lines) {
      parseLine(line.endsWith("\r") ? line.slice(0, -1) : line);
    }
    if (onProgress && totalBytes > 0 && bytesRead - lastReported > 4_000_000) {
      lastReported = bytesRead;
      onProgress(bytesRead / totalBytes);
      // Yield to the event loop so the progress UI can paint
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  leftover += decoder.decode();
  if (leftover.trim().length > 0) parseLine(leftover.replace(/\r$/, ""));

  if (!columns || rowCount === 0) {
    throw new Error("The file is empty or could not be parsed.");
  }

  // Trim over-allocated capacity
  if (rowCount < capacity) {
    matrix = matrix.slice(0, rowCount * columnCount);
  }

  // Per-column stats over the FULL dataset (used for stable chart extents)
  const min = new Array(columnCount).fill(Infinity);
  const max = new Array(columnCount).fill(-Infinity);
  const finiteCount = new Array(columnCount).fill(0);
  for (let i = 0; i < rowCount; i++) {
    const offset = i * columnCount;
    for (let j = 0; j < columnCount; j++) {
      const value = matrix[offset + j];
      if (Number.isFinite(value)) {
        finiteCount[j] += 1;
        if (value < min[j]) min[j] = value;
        if (value > max[j]) max[j] = value;
      }
    }
  }

  onProgress?.(1);
  return { columns, matrix, rowCount, stats: { min, max, finiteCount } };
}

/**
 * Deterministic uniform sample of table rows materialized as plain objects for
 * mark-level rendering and interaction. `__id` is the row index in the full
 * table, so selections map back to the complete dataset.
 */
export function buildDisplaySample(table, sampleSize = DISPLAY_SAMPLE_SIZE) {
  const { columns, matrix, rowCount } = table;
  const columnCount = columns.length;
  const n = Math.min(sampleSize, rowCount);
  const step = rowCount / n;
  const rows = new Array(n);
  for (let k = 0; k < n; k++) {
    const i = Math.floor(k * step);
    const offset = i * columnCount;
    const row = { __id: i, __label: `Alloy ${i + 1}` };
    for (let j = 0; j < columnCount; j++) {
      row[columns[j]] = matrix[offset + j];
    }
    rows[k] = row;
  }
  return rows;
}

/**
 * Evaluate the active brushes against EVERY row of the table.
 * Returns a Uint8Array mask (1 = row passes) and the number of passing rows.
 * ~325k rows x a handful of dimensions is a few million comparisons — runs in
 * single-digit milliseconds, so it is computed synchronously inside a React
 * transition.
 */
export function computeFilterMask(table, brushes) {
  const { columns, matrix, rowCount } = table;
  const columnCount = columns.length;
  const mask = new Uint8Array(rowCount);
  const active = Object.keys(brushes).map((dim) => ({
    index: columns.indexOf(dim),
    lo: brushes[dim][0],
    hi: brushes[dim][1],
  })).filter((b) => b.index >= 0);

  if (active.length === 0) {
    mask.fill(1);
    return { mask, count: rowCount };
  }

  let count = 0;
  for (let i = 0; i < rowCount; i++) {
    const offset = i * columnCount;
    let pass = 1;
    for (const brush of active) {
      const value = matrix[offset + brush.index];
      if (!(value >= brush.lo && value <= brush.hi)) {
        pass = 0;
        break;
      }
    }
    mask[i] = pass;
    count += pass;
  }
  return { mask, count };
}
