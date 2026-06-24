import * as d3 from "d3";
import { Sparkles } from "lucide-react";

export default function SmallMultiplesRadar({
  data,
  selectedIds,
  selectedColors,
  onToggleSelected,
  dimensions,
  shortenLabel,
}) {
  const selectedRows = selectedIds
    .map((id) => data.find((d) => d.__id === id))
    .filter(Boolean);

  if (selectedRows.length === 0) {
    return (
      <div className="flex-grow flex items-center justify-center p-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30 text-slate-400 text-sm">
        Click points in the scatter/bubble chart to compare alloy candidates
      </div>
    );
  }

  // --- RADAR MATH SETUP ---
  const miniRadius = 38;
  const w = 110;
  const h = 115;
  const centerX = w / 2;
  const centerY = h / 2 - 5;
  const angleStep = (Math.PI * 2) / dimensions.length;

  // Compute domains for all dimensions using the full dataset
  const scales = {};
  dimensions.forEach((dimension) => {
    const extent = d3.extent(data, (d) =>
      Number.isFinite(d[dimension]) ? d[dimension] : undefined
    );
    const min = extent[0] !== undefined ? extent[0] : 0;
    const max = extent[1] !== undefined ? extent[1] : 1;
    
    scales[dimension] = d3
      .scaleLinear()
      .domain([min, max])
      .range([0, miniRadius]);
  });

  // Radial line generator
  const radarLine = d3
    .lineRadial()
    .radius((point) => scales[point.dimension](point.value))
    .angle((point) => point.index * angleStep)
    .curve(d3.curveLinearClosed);

  // Compute table normalization (0 to 1 value relative to the selected group range, or full dataset range)
  // Let's normalize relative to the full dataset range to show absolute candidate standings!
  const getNormalizedValue = (row, dimension) => {
    const val = row[dimension];
    if (!Number.isFinite(val)) return 0;
    const scale = scales[dimension];
    const [min, max] = scale.domain();
    if (max === min) return 0.5;
    return (val - min) / (max - min);
  };

  const formatValue = d3.format(".4~g");

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* 1. Small Multiples Radar Charts Grid */}
      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          Candidate Small Multiples Profile
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {selectedRows.map((row) => {
            const values = dimensions.map((dim, idx) => ({
              dimension: dim,
              index: idx,
              value: Number.isFinite(row[dim]) ? row[dim] : 0,
            }));

            const pathData = radarLine(values);

            return (
              <div
                key={row.__id}
                className="flex flex-col items-center bg-white border border-slate-200/80 rounded-lg p-1.5 shadow-sm w-[116px] relative hover:border-slate-300 transition-colors group"
              >
                {/* Remove button */}
                <button
                  onClick={() => onToggleSelected(row.__id)}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center font-bold text-[10px] cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  title="Deselect"
                >
                  &times;
                </button>
                <div className="text-[10px] font-bold text-slate-800 truncate max-w-[100px] mb-1">
                  {row.__label}
                </div>

                <svg width={w} height={h} className="block select-none overflow-visible">
                  <g transform={`translate(${centerX},${centerY})`}>
                    {/* Concentric grids (3 levels) */}
                    {[1, 2, 3].map((level) => (
                      <circle
                        key={level}
                        r={(miniRadius * level) / 3}
                        fill="none"
                        stroke="#f1f5f9"
                        stroke-width={0.75}
                      />
                    ))}

                    {/* Radial axis lines */}
                    {dimensions.map((dim, idx) => {
                      const angle = idx * angleStep - Math.PI / 2;
                      const axisX = miniRadius * Math.cos(angle);
                      const axisY = miniRadius * Math.sin(angle);
                      return (
                        <line
                          key={dim}
                          x1={0}
                          y1={0}
                          x2={axisX}
                          y2={axisY}
                          stroke="#f8fafc"
                          stroke-width={1.2}
                        />
                      );
                    })}

                    {/* Radar Polyline */}
                    <path
                      d={pathData}
                      fill={selectedColors[row.__id]}
                      fillOpacity={0.06}
                      stroke={selectedColors[row.__id]}
                      stroke-width={1.5}
                    />

                    {/* Rotated labels on outer limits */}
                    {dimensions.map((dim, idx) => {
                      const angle = idx * angleStep - Math.PI / 2;
                      const axisX = (miniRadius + 7) * Math.cos(angle);
                      const axisY = (miniRadius + 7) * Math.sin(angle);
                      return (
                        <text
                          key={dim}
                          x={axisX}
                          y={axisY}
                          text-anchor="middle"
                          alignment-baseline="middle"
                          fill="#94a3b8"
                          style={{ fontSize: "6.5px", fontWeight: "600" }}
                        >
                          {shortenLabel(dim, 5)}
                        </text>
                      );
                    })}
                  </g>
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Candidate Property Comparison Matrix Heatmap Table */}
      <div className="flex-grow flex flex-col min-h-[160px]">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>Compare Matrix (Color represents normalized property standing 0-1)</span>
        </div>
        <div className="flex-grow overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
          <table className="w-full text-[10px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-3 py-2 font-bold uppercase tracking-wider text-[9px] border-r border-slate-200 min-w-[70px]">
                  Alloy
                </th>
                {dimensions.map((dim) => (
                  <th
                    key={dim}
                    className="px-2.5 py-2 font-bold uppercase tracking-wider text-[9px] border-r border-slate-200 min-w-[60px]"
                    title={dim}
                  >
                    {shortenLabel(dim, 10)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedRows.map((row) => (
                <tr key={row.__id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-semibold text-slate-700 border-r border-slate-200 bg-slate-50/20 flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: selectedColors[row.__id] }}
                    />
                    <span className="truncate">{row.__label}</span>
                  </td>
                  {dimensions.map((dim) => {
                    const norm = getNormalizedValue(row, dim);
                    // Color background from white to soft blue based on normalized value
                    const bgColor = d3.interpolateBlues(norm * 0.4); // limit intensity for light backgrounds

                    return (
                      <td
                        key={dim}
                        className="px-2.5 py-2 font-medium text-slate-800 border-r border-slate-200 transition-colors"
                        style={{ backgroundColor: bgColor }}
                      >
                        <div className="flex flex-col">
                          <span>{formatValue(row[dim])}</span>
                          <span className="text-[8px] text-slate-400">
                            {Math.round(norm * 100)}%
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
