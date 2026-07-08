import { useState, useTransition, useEffect, useCallback } from "react";
import * as d3 from "d3";
import Dashboard from "./components/Dashboard";
import { streamParseTable, buildDisplaySample, computeFilterMask } from "./utils/dataLoader";
import { Upload, FileText, AlertCircle, RefreshCw } from "lucide-react";

// Pure helper constants and functions moved outside the component function
const SCRAP_COLUMNS = [
  "KS1295[%]",
  "6082[%]",
  "2024[%]",
  "bat-box[%]",
  "Batterybox [%]",
  "3003[%]",
  "3003 [%]",
  "4032[%]",
  "4043 [%]",
];
const COMPOSITION_COLUMNS = [
  "Al",
  "Si",
  "Cu",
  "Ni",
  "Mg",
  "Mn",
  "Fe",
  "Cr",
  "Ti",
  "Zr",
  "V",
  "Zn",
];

const colorForColumnGroup = (column) => {
  if (SCRAP_COLUMNS.includes(column)) {
    return "#2563eb"; // slate blue
  }
  if (COMPOSITION_COLUMNS.includes(column)) {
    return "#16a34a"; // emerald green
  }
  if (column.startsWith("Vf_")) {
    return "#dc2626"; // red
  }
  return "#ea580c"; // orange/amber
};

const shortenLabel = (label, maxLength = 16) => {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1) + "…";
};

const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

export default function App() {
  // Columnar typed-array table holding ALL rows (~91 MB for the full dataset)
  const [table, setTable] = useState(null);
  // Deterministic display sample as row objects (marks only; stats use table)
  const [sampleRows, setSampleRows] = useState([]);
  const [filteredSampleRows, setFilteredSampleRows] = useState([]);
  const [filterMask, setFilterMask] = useState(null);
  const [filteredCount, setFilteredCount] = useState(0);
  const [numericColumns, setNumericColumns] = useState([]);
  const [filename, setFilename] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Coordinated states
  const [brushes, setBrushes] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedColors, setSelectedColors] = useState({});

  // Use transition for filtering to keep UI responsive
  const [, startTransition] = useTransition();

  // Stream-parse a byte stream into the columnar table and derive view state
  const loadFromStream = useCallback(async (byteStream, totalBytes, name) => {
    setIsLoading(true);
    setErrorMsg("");
    setLoadProgress(0);
    try {
      const parsedTable = await streamParseTable(byteStream, totalBytes, (fraction) => {
        setLoadProgress(Math.round(fraction * 100));
      });

      // Numeric columns = columns with at least one finite value in ANY row
      const numCols = parsedTable.columns.filter(
        (_, j) => parsedTable.stats.finiteCount[j] > 0
      );
      if (numCols.length === 0) {
        throw new Error("No numeric columns found in the dataset.");
      }

      const sample = buildDisplaySample(parsedTable);

      setTable(parsedTable);
      setSampleRows(sample);
      setFilteredSampleRows(sample);
      setFilterMask(null);
      setFilteredCount(parsedTable.rowCount);
      setNumericColumns(numCols);
      setFilename(name);

      // Reset coordinated states
      setBrushes({});
      setSelectedIds([]);
      setSelectedColors({});
      setIsLoading(false);
    } catch (err) {
      // An aborted load (StrictMode remount / dataset switch) is not an error
      // and must not touch state the replacing load already owns
      if (err?.name === "AbortError") return;
      console.error(err);
      setErrorMsg(err.message || "An error occurred parsing the file.");
      setIsLoading(false);
    }
  }, []);

  const processFile = (file) => {
    // File.stream() avoids materializing the whole file as a giant string
    loadFromStream(file.stream(), file.size, file.name);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // Automatically stream the default alloy dataset served by Vite on mount.
  // The AbortController cancels the duplicate request StrictMode fires when it
  // double-mounts effects in development — without it two concurrent 223 MB
  // parses compete for the main thread.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/Dataset_VisContest_Rapid_Alloy_development_v3.txt", {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok || !res.body) {
          throw new Error("Default dataset not found on Vite server.");
        }
        const totalBytes = Number(res.headers.get("Content-Length")) || 0;
        return loadFromStream(
          res.body,
          totalBytes,
          "Dataset_VisContest_Rapid_Alloy_development_v3.txt"
        );
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.log(
          "Auto-load of default dataset bypassed, waiting for manual upload:",
          err.message
        );
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [loadFromStream]);

  // File Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Clear loaded dataset to upload a new one
  const handleClearFile = () => {
    setTable(null);
    setSampleRows([]);
    setFilteredSampleRows([]);
    setFilterMask(null);
    setFilteredCount(0);
    setNumericColumns([]);
    setFilename("");
    setBrushes({});
    setSelectedIds([]);
    setSelectedColors({});
  };

  // Coordinated Brushing Update: the mask/count are evaluated against the
  // FULL table; the sample rows are filtered for mark-level views
  const handleBrushChange = (dimension, range) => {
    const updatedBrushes = { ...brushes };
    if (range) {
      updatedBrushes[dimension] = range;
    } else {
      delete updatedBrushes[dimension];
    }
    setBrushes(updatedBrushes);

    startTransition(() => {
      if (!table) return;
      if (Object.keys(updatedBrushes).length === 0) {
        setFilterMask(null);
        setFilteredCount(table.rowCount);
        setFilteredSampleRows(sampleRows);
        return;
      }

      const { mask, count } = computeFilterMask(table, updatedBrushes);
      setFilterMask(mask);
      setFilteredCount(count);
      setFilteredSampleRows(sampleRows.filter((row) => mask[row.__id] === 1));
    });
  };

  // Remove all axis filters at once
  const handleClearBrushes = () => {
    setBrushes({});
    startTransition(() => {
      if (!table) return;
      setFilterMask(null);
      setFilteredCount(table.rowCount);
      setFilteredSampleRows(sampleRows);
    });
  };

  // Select / Deselect candidate alloy logic (up to 5 alloys max)
  const handleToggleSelected = (id) => {
    const idx = selectedIds.indexOf(id);
    if (idx === -1) {
      const updatedIds = [...selectedIds];
      const updatedColors = { ...selectedColors };

      // Limit to 5 selections
      if (selectedIds.length >= 5) {
        const removed = updatedIds.shift();
        delete updatedColors[removed];
      }

      updatedIds.push(id);
      updatedColors[id] = colorScale(id);

      setSelectedIds(updatedIds);
      setSelectedColors(updatedColors);
    } else {
      const updatedIds = selectedIds.filter((item) => item !== id);
      const updatedColors = { ...selectedColors };
      delete updatedColors[id];

      setSelectedIds(updatedIds);
      setSelectedColors(updatedColors);
    }
  };

  return (
    <main className="min-h-screen text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* Tooltip Target */}
      <div className="tooltip opacity-0 pointer-events-none absolute" />

      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 shrink-0 sticky top-0 z-50">
        <div className="w-11/12 mx-auto px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center text-sm shadow-lg shadow-indigo-500/30 ring-1 ring-white/40">
              Al
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                Alloy Design Explorer
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                IEEE SciVis Contest 2025 Tooling
              </p>
            </div>
          </div>

          <div className="text-[10px] text-indigo-500/80 font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50/60">
            Framework Task 2
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="grow flex flex-col items-stretch">
        {isLoading ? (
          <div className="grow flex flex-col items-center justify-center py-20 px-4">
            <div className="surface-card px-10 py-9 flex flex-col items-center gap-4 max-w-sm w-full">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-violet-500 opacity-20 blur-md animate-pulse" />
                <RefreshCw className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-bold text-slate-800">
                  Streaming alloy dataset… {loadProgress}%
                </h3>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Parsing rows directly into a compact typed-array table — the full file is
                  never held in memory as text.
                </p>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all rounded-full"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : table ? (
          <Dashboard
            table={table}
            filterMask={filterMask}
            filteredCount={filteredCount}
            data={sampleRows}
            filteredData={filteredSampleRows}
            brushes={brushes}
            onBrushChange={handleBrushChange}
            onClearBrushes={handleClearBrushes}
            selectedIds={selectedIds}
            onToggleSelected={handleToggleSelected}
            selectedColors={selectedColors}
            numericColumns={numericColumns}
            colorForColumnGroup={colorForColumnGroup}
            shortenLabel={shortenLabel}
            filename={filename}
            onClearFile={handleClearFile}
          />
        ) : (
          /* File Uploader Landing Page */
          <div className="grow flex items-center justify-center py-16 px-4">
            <div className="max-w-xl w-full surface-card p-8 flex flex-col items-stretch text-center">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/25 ring-1 ring-white/40">
                <Upload className="w-5 h-5" />
              </div>

              <h2 className="text-lg font-bold text-slate-800">
                Upload Alloy Simulation Data
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Supports tab-separated (.txt, .tsv) simulation exports of any size — files are
                streamed, so even multi-hundred-MB datasets load safely.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="mt-6 border-2 border-dashed border-slate-200 hover:border-indigo-400/70 rounded-2xl p-8 bg-slate-50/60 hover:bg-indigo-50/30 cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center relative"
              >
                <input
                  type="file"
                  id="file-input"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileText className="w-8 h-8 text-slate-300 group-hover:text-blue-400 transition-colors mb-3" />
                <span className="text-xs font-semibold text-slate-700">
                  Drag and drop your dataset here
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  or click to browse local files
                </span>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-left text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error loading file:</span> {errorMsg}
                  </div>
                </div>
              )}

              {/* Quick scientific details */}
              <div className="mt-8 pt-6 border-t border-slate-100 text-left">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Dataset Scientific Context
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This screening environment explores chemical composition thresholds, crystallographic phase formations (<code className="bg-slate-100 px-1 rounded text-red-600 font-mono text-[10px]">Vf_...</code>), scrap alloy recycled percentages, and downstream mechanical properties like Vickers hardness, strength, density, and thermal conductivity.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer credits */}
      <footer className="bg-white/60 backdrop-blur border-t border-slate-200/60 shrink-0 text-center py-4 text-[11px] text-slate-400 font-medium">
        University of Passau &bull; Faculty of Computer Science and Mathematics &bull; Chair of Cognitive Sensor Systems
      </footer>
    </main>
  );
}
