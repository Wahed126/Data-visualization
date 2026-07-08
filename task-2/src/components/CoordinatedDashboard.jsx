import { useState } from "react";
import ParallelCoordinates from "./ParallelCoordinates";
import ScatterBubbleChart from "./ScatterBubbleChart";
import Histogram from "./Histogram";
import RadarChart from "./RadarChart";
import { Info, BarChart2, Eye, Sliders, Activity } from "lucide-react";

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

export default function CoordinatedDashboard({
  data,
  filteredData,
  brushes,
  onBrushChange,
  selectedIds,
  onToggleSelected,
  selectedColors,
  numericColumns,
  colorForColumnGroup,
  shortenLabel,
  filename,
  onClearFile,
}) {
  // Hoist scatter plot axes selections so they can be read by tooltips and legend
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

  // Hoist histogram axis selection
  const [histogramColumn, setHistogramColumn] = useState(() => {
    return (
      ["YS(MPa)", "YS (MPa)", "hardness(Vickers)", "Hardness (Vickers)"].find((c) =>
        numericColumns.includes(c)
      ) || numericColumns[0]
    );
  });

  // Parallel Coordinates dimensions selection
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
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            Exploration of Recycled Aluminium Alloy Design Space
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active Dataset: <span className="font-semibold text-slate-700">{filename}</span> |{" "}
            <span className="font-medium">{filteredData.length}</span> of{" "}
            <span className="font-medium">{data.length}</span> alloys fit current filters
          </p>
        </div>
        <button
          onClick={onClearFile}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-all duration-200"
        >
          Change Dataset
        </button>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Parallel Coordinates */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md/5 transition-shadow duration-300 flex flex-col min-h-[460px] lg:h-[460px]">
          <div className="flex justify-between items-start mb-1">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                Parallel Coordinates Plot (PCP)
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Drag a vertical selection brush on any axis to filter the dataset
              </p>
            </div>
            {Object.keys(brushes).length > 0 && (
              <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                {Object.keys(brushes).length} axis filters active
              </span>
            )}
          </div>
          <div className="flex-grow min-h-[300px] mt-2">
            <ParallelCoordinates
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

        {/* Chart 2: Scatter / Bubble Plot */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md/5 transition-shadow duration-300 flex flex-col min-h-[460px] lg:h-[460px]">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-500" />
              Scatter / Bubble Chart
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Click dots to add up to 5 alloys to the radar chart comparison list
            </p>
          </div>
          <div className="flex-grow mt-2">
            <ScatterBubbleChart
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

        {/* Chart 3: Histogram */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md/5 transition-shadow duration-300 flex flex-col min-h-[460px] lg:h-[460px]">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-slate-500" />
              Histogram Distribution
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Analyzes frequency distribution for the currently filtered alloy candidates
            </p>
          </div>
          <div className="flex-grow mt-2">
            <Histogram
              filteredData={filteredData}
              numericColumns={numericColumns}
              histogramColumn={histogramColumn}
              setHistogramColumn={setHistogramColumn}
            />
          </div>
        </div>

        {/* Chart 4: Radar Comparison */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md/5 transition-shadow duration-300 flex flex-col min-h-[460px] lg:h-[460px]">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-500" />
              Radar Candidate Comparison
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Radial comparison across key performance metrics of candidate alloys
            </p>
          </div>
          <div className="flex-grow mt-2">
            <RadarChart
              data={data}
              selectedIds={selectedIds}
              selectedColors={selectedColors}
              onToggleSelected={onToggleSelected}
              dimensions={radarDimensions}
              shortenLabel={shortenLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
