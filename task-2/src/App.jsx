import { useState, useTransition, useEffect, useCallback } from "react";
import * as d3 from "d3";
import CoordinatedDashboard from "./components/CoordinatedDashboard";
import AdvancedDashboard from "./components/AdvancedDashboard";
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

// Detect delimiter based on first line counts
const detectDelimiter = (text, name) => {
  const lowerName = name.toLowerCase();
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  
  if (lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")) {
    return "\t";
  }
  if (lowerName.endsWith(".csv")) {
    return ",";
  }

  const counts = {
    "\t": (firstLine.match(/\t/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
  };

  return Object.keys(counts).reduce((best, delim) =>
    counts[delim] > counts[best] ? delim : best, ","
  );
};

// Clean trailing delimiter issues (e.g. trailing tabs in Zenodo TXT files)
const sanitizeDelimitedText = (text, delimiter) => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (delimiter === "\t") {
    return normalized
      .split("\n")
      .map((line) => line.replace(/\t+$/g, ""))
      .join("\n");
  }
  return normalized;
};

// Deterministic uniform sampling to maintain sub-second rendering speeds
const sampleRows = (rows, maxRows = 5000) => {
  if (rows.length <= maxRows) return rows;
  const step = rows.length / maxRows;
  return d3.range(maxRows).map((idx) => rows[Math.floor(idx * step)]);
};

const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

export default function App() {
  const [dataset, setDataset] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [numericColumns, setNumericColumns] = useState([]);
  const [filename, setFilename] = useState("");
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash;
    return hash === "#density" ? "density" : "standard";
  });
  // Start with loading = true by default as we attempt to auto-load the workspace dataset
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync state with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setActiveView(hash === "#density" ? "density" : "standard");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (window.location.hash !== `#${activeView}`) {
      window.location.hash = activeView;
    }
  }, [activeView]);

  // Coordinated states
  const [brushes, setBrushes] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedColors, setSelectedColors] = useState({});

  // Use transition for filtering to keep UI responsive
  const [, startTransition] = useTransition();

  // Load and parse uploaded dataset helper wrapped in useCallback
  const parseAndLoadData = useCallback((text, name) => {
    const delimiter = detectDelimiter(text, name);
    const sanitized = sanitizeDelimitedText(text, delimiter);
    const parser = d3.dsvFormat(delimiter);
    const parsed = parser.parse(sanitized);

    if (parsed.length === 0) {
      throw new Error("The file is empty or could not be parsed.");
    }

    const columns = Object.keys(parsed[0]);
    // Identify numeric columns
    const numCols = columns.filter((col) => {
      return parsed.some((row) => {
        const val = Number(row[col]);
        return Number.isFinite(val) && row[col] !== "";
      });
    });

    if (numCols.length === 0) {
      throw new Error("No numeric columns found in the dataset.");
    }

    // Clean & cast rows
    const casted = parsed.map((row, idx) => {
      const parsedRow = {
        __id: idx,
        __label: `Alloy ${idx + 1}`,
      };

      columns.forEach((col) => {
        const numericValue = row[col] === "" ? NaN : Number(row[col]);
        
        // Treat NaNs in phase fraction (Vf_...) columns as 0 (means phase did not form)
        if (!Number.isFinite(numericValue) && col.startsWith("Vf_")) {
          parsedRow[col] = 0;
        } else if (Number.isFinite(numericValue)) {
          parsedRow[col] = numericValue;
        } else {
          parsedRow[col] = row[col];
        }
      });

      return parsedRow;
    });

    // Sample for rendering
    const sampled = sampleRows(casted, 5000);

    setDataset(sampled);
    setFilteredData(sampled);
    setNumericColumns(numCols);
    setFilename(name);
    
    // Reset coordinated states
    setBrushes({});
    setSelectedIds([]);
    setSelectedColors({});
  }, []);

  const processFile = (file) => {
    setIsLoading(true);
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") {
          throw new Error("File content is not valid text");
        }
        parseAndLoadData(text, file.name);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || "An error occurred parsing the file.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("Error reading file.");
      setIsLoading(false);
    };

    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // Automatically fetch the default alloy dataset served by Vite if available on mount
  useEffect(() => {
    fetch("/Dataset_VisContest_Rapid_Alloy_development_v3.txt")
      .then((res) => {
        if (!res.ok) throw new Error("Default dataset not found on Vite server.");
        return res.text();
      })
      .then((text) => {
        parseAndLoadData(text, "Dataset_VisContest_Rapid_Alloy_development_v3.txt");
      })
      .catch((err) => {
        console.log("Auto-load of default dataset bypassed, waiting for manual upload:", err.message);
        setIsLoading(false); // set to false since we are skipping auto-load and showing uploader
      })
      .finally(() => {
        // Only turn off loading in case of success (error case is handled above)
        // If loaded, parseAndLoadData resets states and loading can end
        setIsLoading(false);
      });
  }, [parseAndLoadData]);

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
    setDataset([]);
    setFilteredData([]);
    setNumericColumns([]);
    setFilename("");
    setBrushes({});
    setSelectedIds([]);
    setSelectedColors({});
  };

  // Coordinated Brushing Update
  const handleBrushChange = (dimension, range) => {
    const updatedBrushes = { ...brushes };
    if (range) {
      updatedBrushes[dimension] = range;
    } else {
      delete updatedBrushes[dimension];
    }
    setBrushes(updatedBrushes);

    // Compute updated filter using React Transitions to prevent layout lag
    startTransition(() => {
      if (Object.keys(updatedBrushes).length === 0) {
        setFilteredData(dataset);
        return;
      }

      const activeDimensions = Object.keys(updatedBrushes);
      const filtered = dataset.filter((row) => {
        return activeDimensions.every((dim) => {
          const val = row[dim];
          const brushRange = updatedBrushes[dim];
          return Number.isFinite(val) && val >= brushRange[0] && val <= brushRange[1];
        });
      });
      setFilteredData(filtered);
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
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased">
      {/* Tooltip Target */}
      <div className="tooltip opacity-0 pointer-events-none absolute" />

      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 shrink-0 sticky top-0 z-50 shadow-sm/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-500 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-blue-500/25">
              Al
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
                Alloy Design Explorer
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">
                IEEE SciVis Contest 2025 Tooling
              </p>
            </div>
          </div>

          {/* Design Comparison View Toggle */}
          {dataset.length > 0 && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setActiveView("standard")}
                className={`px-3.5 py-1.5 rounded-md font-semibold cursor-pointer transition-all duration-200 ${
                  activeView === "standard"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Design A: Standard
              </button>
              <button
                onClick={() => setActiveView("density")}
                className={`px-3.5 py-1.5 rounded-md font-semibold cursor-pointer transition-all duration-200 ${
                  activeView === "density"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Design B: Density-Aware
              </button>
            </div>
          )}

          <div className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase">
            Framework Task 2
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col items-stretch">
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center gap-4 py-20">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-800">Processing alloy dataset...</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                Validating columns, casting values, and generating deterministic samples.
              </p>
            </div>
          </div>
        ) : dataset.length > 0 ? (
          activeView === "standard" ? (
            <CoordinatedDashboard
              data={dataset}
              filteredData={filteredData}
              brushes={brushes}
              onBrushChange={handleBrushChange}
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
            <AdvancedDashboard
              data={dataset}
              filteredData={filteredData}
              brushes={brushes}
              onBrushChange={handleBrushChange}
              selectedIds={selectedIds}
              onToggleSelected={handleToggleSelected}
              selectedColors={selectedColors}
              numericColumns={numericColumns}
              colorForColumnGroup={colorForColumnGroup}
              shortenLabel={shortenLabel}
              filename={filename}
              onClearFile={handleClearFile}
            />
          )
        ) : (
          /* File Uploader Landing Page */
          <div className="flex-grow flex items-center justify-center py-16 px-4">
            <div className="max-w-xl w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col items-stretch text-center">
              <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              
              <h2 className="text-lg font-bold text-slate-800">
                Upload Alloy Simulation Data
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Supports standard tab-separated (.txt, .tsv) or comma-separated (.csv) files from simulation runs.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="mt-6 border-2 border-dashed border-slate-200 hover:border-blue-400/80 rounded-2xl p-8 bg-slate-50/50 hover:bg-blue-50/10 cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center relative"
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
      <footer className="bg-white border-t border-slate-200/80 shrink-0 text-center py-4 text-[11px] text-slate-400 font-medium">
        University of Passau &bull; Faculty of Computer Science and Mathematics &bull; Chair of Cognitive Sensor Systems
      </footer>
    </main>
  );
}
