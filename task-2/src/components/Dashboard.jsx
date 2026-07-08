import { useState } from "react";
import ParallelCoordinatesCanvas from "./ParallelCoordinatesCanvas";
import HeatmapScatterPlot from "./HeatmapScatterPlot";
import EmbeddingView from "./EmbeddingView";
import RadarChart from "./RadarChart";
import { Info, Eye, Sliders, Map, Activity, FilterX } from "lucide-react";

// Constants declared outside the component to avoid hook dependency triggers
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
const DEFAULT_PHASE_COLUMNS = ["Vf_FCC_A1", "Vf_DIAMOND_A4", "Vf_AL15SI2M4", "Vf_AL3X"];
const DEFAULT_PROPERTY_COLUMN_HINTS = [
  "YS(MPa)",
  "YS (MPa)",
  "hardness(Vickers)",
  "Hardness (Vickers)",
  "Therm.conductivity(W/(mK))",
  "Therm. conductivity (W/(m·K))",
  "Density(g/cm3)",
  "Density (g/cm³)",
];
const DEFAULT_RADAR_COLUMN_HINTS = [
  "YS(MPa)",
  "YS (MPa)",
  "hardness(Vickers)",
  "Hardness (Vickers)",
  "Therm.conductivity(W/(mK))",
  "Therm. conductivity (W/(m·K))",
  "Density(g/cm3)",
  "Density (g/cm³)",
  "El.conductivity(S/m)",
  "El. conductivity (S/m)",
  "CSC",
];

export default function Dashboard({
  table,
  filterMask,
  filteredCount,
  data,
  filteredData,
  brushes,
  onBrushChange,
  onClearBrushes,
  selectedIds,
  onToggleSelected,
  selectedColors,
  numericColumns,
  colorForColumnGroup,
  shortenLabel,
  filename,
  onClearFile,
}) {
  // Density heatmap axis selections
  const [xScatterColumn, setXScatterColumn] = useState(() => {
    return ["Si", "Cu", "Mg"].find((c) => numericColumns.includes(c)) || numericColumns[0];
  });
  const [yScatterColumn, setYScatterColumn] = useState(() => {
    return (
      ["YS(MPa)", "YS (MPa)", "hardness(Vickers)", "Hardness (Vickers)"].find((c) =>
        numericColumns.includes(c)
      ) ||
      numericColumns[1] ||
      numericColumns[0]
    );
  });
  const [sizeScatterColumn, setSizeScatterColumn] = useState(() => {
    return (
      ["hardness(Vickers)", "Hardness (Vickers)", "YS(MPa)", "YS (MPa)"].find((c) =>
        numericColumns.includes(c)
      ) ||
      numericColumns[2] ||
      numericColumns[0]
    );
  });

  // Parallel Coordinates dimensions: scrap -> elements -> phases -> properties
  // mirrors the physical causality chain the contest asks about
  const preferredParallelColumns = SCRAP_COLUMNS.concat(
    ["Si", "Cu", "Mg", "Fe"],
    DEFAULT_PHASE_COLUMNS,
    DEFAULT_PROPERTY_COLUMN_HINTS
  );
  const matchedParallelDimensions = preferredParallelColumns.filter((column) =>
    numericColumns.includes(column)
  );
  const parallelDimensions =
    matchedParallelDimensions.length >= 4
      ? Array.from(new Set(matchedParallelDimensions)).slice(0, 16)
      : numericColumns.slice(0, 12);

  // Radar dimensions selection
  const matchedRadarDimensions = DEFAULT_RADAR_COLUMN_HINTS.filter((column) =>
    numericColumns.includes(column)
  );
  const radarDimensions =
    matchedRadarDimensions.length >= 3
      ? matchedRadarDimensions
      : numericColumns.slice(0, 6);

  return (
    <div className="flex flex-col gap-6 w-full mx-auto px-4 py-6">
      {/* Dashboard Top Metadata Bar */}
      <div className="hero-gradient rounded-2xl p-5 sm:p-6 shadow-lg shadow-indigo-900/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white ring-1 ring-white/10">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur">
              <Activity className="w-4 h-4 text-white" />
            </span>
            Exploration of Recycled Aluminium Alloy Design Space
          </h1>
          <p className="text-xs text-indigo-100/80 mt-1.5 truncate pl-[42px]">
            Active Dataset: <span className="font-semibold text-white/95">{filename}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Live stats chips */}
          <span
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border backdrop-blur ${
              filteredCount < table.rowCount
                ? "bg-white text-indigo-700 border-white shadow-sm"
                : "bg-white/10 text-white border-white/25"
            }`}
          >
            {filteredCount.toLocaleString()} / {table.rowCount.toLocaleString()} alloys
          </span>
          {selectedIds.length > 0 && (
            <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-amber-300/90 text-amber-950 border border-amber-200/60 shadow-sm">
              {selectedIds.length} selected
            </span>
          )}
          {Object.keys(brushes).length > 0 && (
            <button
              onClick={onClearBrushes}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white text-[11px] font-semibold rounded-full cursor-pointer transition-colors backdrop-blur"
              title="Remove all axis filters"
            >
              <FilterX className="w-3.5 h-3.5" />
              Clear {Object.keys(brushes).length} filter{Object.keys(brushes).length > 1 ? "s" : ""}
            </button>
          )}
          <button
            onClick={onClearFile}
            className="px-3.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full shadow-sm cursor-pointer transition-colors"
          >
            Change Dataset
          </button>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Parallel Coordinates (Canvas Density) */}
        <div className="surface-card p-5 flex flex-col h-[480px]">
          <div className="flex justify-between items-start mb-1">
            <div>
              <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <Sliders className="w-4 h-4 text-blue-500" />
                Parallel Coordinates Plot (PCP)
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Scrap → elements → phases → properties. Brush any vertical axis to filter the
                whole dashboard.
              </p>
            </div>
            {Object.keys(brushes).length > 0 && (
              <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                {Object.keys(brushes).length} axis filters active
              </span>
            )}
          </div>
          <div className="flex-grow min-h-[300px] mt-2 relative min-w-0 overflow-hidden">
            <ParallelCoordinatesCanvas
              data={data}
              filteredData={filteredData}
              dimensions={parallelDimensions}
              brushes={brushes}
              onBrushChange={onBrushChange}
              colorForColumnGroup={colorForColumnGroup}
              shortenLabel={shortenLabel}
            />
          </div>
        </div>

        {/* Chart 2: PCA Embedding */}
        <div className="surface-card p-5 flex flex-col h-[480px]">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <Map className="w-4 h-4 text-emerald-500" />
              PCA Embedding Scatter Plot
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              PCA fitted on all {table.rowCount.toLocaleString()} alloys. Loading vectors show
              which variables drive each direction. Click dots to compare in the radar.
            </p>
          </div>
          <div className="flex-grow mt-2 min-h-0 min-w-0 overflow-hidden">
            <EmbeddingView
              table={table}
              data={data}
              filteredData={filteredData}
              selectedIds={selectedIds}
              selectedColors={selectedColors}
              onToggleSelected={onToggleSelected}
              numericColumns={numericColumns}
              colorForColumnGroup={colorForColumnGroup}
              shortenLabel={shortenLabel}
            />
          </div>
        </div>

        {/* Chart 3: Full-data 2D Density Heatmap with Drill-down */}
        <div className="surface-card p-5 flex flex-col h-[480px]">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <Eye className="w-4 h-4 text-indigo-500" />
              2D Density Heatmap & Drill-down Scatter
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Log-scale cell counts over all {table.rowCount.toLocaleString()} alloys — no
              overplotting. Click a cell to drill down and select individual candidates.
            </p>
          </div>
          <div className="flex-grow mt-2 min-w-0 overflow-hidden">
            <HeatmapScatterPlot
              table={table}
              filterMask={filterMask}
              filteredData={filteredData}
              numericColumns={numericColumns}
              selectedIds={selectedIds}
              selectedColors={selectedColors}
              onToggleSelected={onToggleSelected}
              radarDimensions={radarDimensions}
              xColumn={xScatterColumn}
              setXColumn={setXScatterColumn}
              yColumn={yScatterColumn}
              setYColumn={setYScatterColumn}
              sizeColumn={sizeScatterColumn}
              setSizeColumn={setSizeScatterColumn}
            />
          </div>
        </div>

        {/* Chart 4: Radar Comparison */}
        <div className="surface-card p-5 flex flex-col h-[480px]">
          <div>
            <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                4
              </span>
              <Info className="w-4 h-4 text-amber-500" />
              Radar Chart — Candidate Comparison
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Property profiles of up to 5 candidates selected in the embedding or drill-down.
            </p>
          </div>
          <div className="flex-grow mt-2 min-h-0 min-w-0 overflow-hidden">
            <RadarChart
              data={data}
              selectedIds={selectedIds}
              selectedColors={selectedColors}
              onToggleSelected={onToggleSelected}
              dimensions={radarDimensions}
              shortenLabel={shortenLabel}
            />
          </div>
          {selectedIds.length >= 2 && (
            <p className="shrink-0 mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-400 leading-relaxed">
              Each polygon is one selected alloy. Every axis is normalized to the range of the
              full dataset, so the outer ring marks the dataset maximum for that property — a
              larger polygon means values closer to the extremes, not a "better" alloy: for
              density or crack susceptibility (CSC), smaller is usually preferable.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
