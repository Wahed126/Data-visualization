import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ArrowLeft, ZoomIn } from "lucide-react";

export default function HeatmapScatterPlot({
  table,
  filterMask,
  filteredData,
  numericColumns,
  selectedIds,
  selectedColors,
  onToggleSelected,
  radarDimensions,
  xColumn,
  setXColumn,
  yColumn,
  setYColumn,
  sizeColumn,
  setSizeColumn,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 400 });

  // Grid / Drill-down state
  // selectedCell holds { col, row } of the cell currently drilled down
  const [selectedCell, setSelectedCell] = useState(null);

  // Handle responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setSize({
        width: Math.max(width, 400),
        height: Math.max(height || 360, 360),
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Stable domains from the FULL dataset column stats, so the grid does not
  // jump around while brushing
  const bounds = useMemo(() => {
    if (!table) return null;
    const xIdx = table.columns.indexOf(xColumn);
    const yIdx = table.columns.indexOf(yColumn);
    const sIdx = table.columns.indexOf(sizeColumn);
    if (xIdx < 0 || yIdx < 0 || sIdx < 0) return null;
    const range = (idx) => {
      const lo = table.stats.min[idx];
      const hi = table.stats.max[idx];
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
      return lo === hi ? [lo - 1, lo + 1] : [lo, hi];
    };
    const xRange = range(xIdx);
    const yRange = range(yIdx);
    const sizeRange = range(sIdx);
    if (!xRange || !yRange || !sizeRange) return null;
    return { xRange, yRange, sizeRange, xIdx, yIdx };
  }, [table, xColumn, yColumn, sizeColumn]);

  // Binning details: 20x20 grid
  const GRID_SIZE = 20;

  // Bin ALL table rows that pass the current filter mask — the density shown
  // is the true density of the complete 324k-row dataset, not of a sample
  const binsData = useMemo(() => {
    if (!bounds || !table) return [];
    const { columns, matrix, rowCount } = table;
    const columnCount = columns.length;
    const { xIdx, yIdx, xRange, yRange } = bounds;
    const xSpan = xRange[1] - xRange[0];
    const ySpan = yRange[1] - yRange[0];

    const counts = new Float64Array(GRID_SIZE * GRID_SIZE);
    const sumX = new Float64Array(GRID_SIZE * GRID_SIZE);
    const sumY = new Float64Array(GRID_SIZE * GRID_SIZE);

    for (let i = 0; i < rowCount; i++) {
      if (filterMask && filterMask[i] === 0) continue;
      const offset = i * columnCount;
      const xVal = matrix[offset + xIdx];
      const yVal = matrix[offset + yIdx];
      if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) continue;
      let colIdx = Math.floor(((xVal - xRange[0]) / xSpan) * GRID_SIZE);
      let rowIdx = Math.floor(((yVal - yRange[0]) / ySpan) * GRID_SIZE);
      colIdx = Math.max(0, Math.min(GRID_SIZE - 1, colIdx));
      rowIdx = Math.max(0, Math.min(GRID_SIZE - 1, rowIdx));
      const cell = rowIdx * GRID_SIZE + colIdx;
      counts[cell] += 1;
      sumX[cell] += xVal;
      sumY[cell] += yVal;
    }

    const flatBins = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = r * GRID_SIZE + c;
        if (counts[cell] > 0) {
          flatBins.push({
            row: r,
            col: c,
            count: counts[cell],
            avgX: sumX[cell] / counts[cell],
            avgY: sumY[cell] / counts[cell],
          });
        }
      }
    }
    return flatBins;
  }, [table, filterMask, bounds]);

  // Drill-down points come from the display sample (only individual marks are
  // sampled; the density grid above always reflects the full data)
  const cellPoints = useMemo(() => {
    if (!selectedCell || !bounds) return [];
    const { xRange, yRange } = bounds;
    const xSpan = xRange[1] - xRange[0];
    const ySpan = yRange[1] - yRange[0];
    return filteredData.filter((row) => {
      const xVal = row[xColumn];
      const yVal = row[yColumn];
      if (!Number.isFinite(xVal) || !Number.isFinite(yVal) || !Number.isFinite(row[sizeColumn]))
        return false;
      const colIdx = Math.max(
        0,
        Math.min(GRID_SIZE - 1, Math.floor(((xVal - xRange[0]) / xSpan) * GRID_SIZE))
      );
      const rowIdx = Math.max(
        0,
        Math.min(GRID_SIZE - 1, Math.floor(((yVal - yRange[0]) / ySpan) * GRID_SIZE))
      );
      return colIdx === selectedCell.col && rowIdx === selectedCell.row;
    });
  }, [selectedCell, bounds, filteredData, xColumn, yColumn, sizeColumn]);

  // Redraw when states change
  useEffect(() => {
    if (!svgRef.current || !bounds || binsData.length === 0) return;

    const { width, height } = size;
    const margins = { top: 25, right: 30, bottom: 65, left: 65 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margins.left},${margins.top})`);

    const xScale = d3.scaleLinear().domain(bounds.xRange).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(bounds.yRange).range([innerHeight, 0]).nice();
    const sizeScale = d3.scaleSqrt().domain(bounds.sizeRange).range([4, 14]);

    // Draw Axes
    plot
      .append("g")
      .attr("class", "d3-axis")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6));

    plot
      .append("g")
      .attr("class", "d3-axis")
      .call(d3.axisLeft(yScale).ticks(6));

    // Titles
    plot
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text(xColumn);

    plot
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text(yColumn);

    // Tooltip
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    }

    const formatValue = d3.format(".4~g");

    // Colors: Log scale for density grid cells (shades of clean blue)
    const maxBinCount = d3.max(binsData, (d) => d.count) || 1;
    const colorScale = d3
      .scaleLog()
      .domain([1, maxBinCount])
      .range(["#eff6ff", "#1d4ed8"]); // slate-50 to blue-700

    const cellW = innerWidth / GRID_SIZE;
    const cellH = innerHeight / GRID_SIZE;

    // Draw background grid squares if not zoomed in, or faint if zoomed in
    const gridGroup = plot.append("g").attr("class", "heatmap-cells");

    gridGroup
      .selectAll("rect")
      .data(binsData)
      .enter()
      .append("rect")
      .attr("x", (d) => xScale(bounds.xRange[0] + (d.col * (bounds.xRange[1] - bounds.xRange[0])) / GRID_SIZE))
      .attr("y", (d) => yScale(bounds.yRange[0] + ((d.row + 1) * (bounds.yRange[1] - bounds.yRange[0])) / GRID_SIZE))
      .attr("width", cellW - 0.5)
      .attr("height", cellH - 0.5)
      .attr("fill", (d) => {
        if (selectedCell) {
          // If zoomed in, render other cells in faint gray
          return selectedCell.col === d.col && selectedCell.row === d.row
            ? "#dbeafe" // highlighted light blue
            : "#f1f5f9";
        }
        return colorScale(d.count);
      })
      .attr("stroke", (d) => {
        if (selectedCell && selectedCell.col === d.col && selectedCell.row === d.row) {
          return "#3b82f6";
        }
        return "none";
      })
      .attr("stroke-width", 1.5)
      .attr("opacity", selectedCell ? 0.35 : 0.85)
      .style("cursor", selectedCell ? "default" : "zoom-in")
      .on("click", (event, d) => {
        if (!selectedCell) {
          setSelectedCell({ col: d.col, row: d.row });
        }
      })
      .on("mouseover", (event, d) => {
        if (selectedCell) return;
        tooltip
          .style("opacity", 1)
          .html(
            `<div><strong>Density Cell</strong></div>` +
              `<div><strong>Contains</strong>: ${d.count} alloys</div>` +
              `<div><strong>Avg ${xColumn}</strong>: ${formatValue(d.avgX)}</div>` +
              `<div><strong>Avg ${yColumn}</strong>: ${formatValue(d.avgY)}</div>`
          );
      })
      .on("mousemove", (event) => {
        if (selectedCell) return;
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    // --- ZOOMED DRILL-DOWN SCATTER OVERLAY ---
    if (selectedCell) {
      const pointsToRender = cellPoints;

      const scatterGroup = plot.append("g").attr("class", "drilldown-scatter");

      scatterGroup
        .selectAll("circle")
        .data(pointsToRender, (d) => d.__id)
        .enter()
        .append("circle")
        .attr("cx", (d) => xScale(d[xColumn]))
        .attr("cy", (d) => yScale(d[yColumn]))
        .attr("r", (d) => sizeScale(d[sizeColumn]))
        .attr("fill", (d) => (selectedIds.includes(d.__id) ? selectedColors[d.__id] : "#475569"))
        .attr("stroke", (d) => (selectedIds.includes(d.__id) ? "#0f172a" : "#ffffff"))
        .attr("stroke-width", (d) => (selectedIds.includes(d.__id) ? 2 : 1))
        .attr("opacity", 0.9)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          onToggleSelected(d.__id);
        })
        .on("mouseover", (event, d) => {
          const showCols = Array.from(
            new Set([xColumn, yColumn, sizeColumn].concat(radarDimensions).filter(Boolean))
          );
          const htmlDetails = showCols
            .map((col) => `<div><strong>${col}</strong>: ${formatValue(d[col])}</div>`)
            .join("");

          tooltip
            .style("opacity", 1)
            .html(`<div><strong>${d.__label}</strong> (Click to Toggle)</div>${htmlDetails}`);
        })
        .on("mousemove", (event) => {
          tooltip
            .style("left", `${event.pageX + 12}px`)
            .style("top", `${event.pageY + 12}px`);
        })
        .on("mouseout", () => {
          tooltip.style("opacity", 0);
        });
    }
  }, [size, bounds, binsData, cellPoints, xColumn, yColumn, sizeColumn, selectedCell, selectedIds, selectedColors, radarDimensions, onToggleSelected]);

  return (
    <div className="flex flex-col h-full">
      {/* Configuration bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">X:</span>
            <select
              value={xColumn}
              onChange={(e) => {
                setXColumn(e.target.value);
                setSelectedCell(null);
              }}
              className="control-select text-xs max-w-[120px] truncate"
            >
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Y:</span>
            <select
              value={yColumn}
              onChange={(e) => {
                setYColumn(e.target.value);
                setSelectedCell(null);
              }}
              className="control-select text-xs max-w-[120px] truncate"
            >
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Bubble:</span>
            <select
              value={sizeColumn}
              onChange={(e) => {
                setSizeColumn(e.target.value);
                setSelectedCell(null);
              }}
              className="control-select text-xs max-w-[120px] truncate"
            >
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drill-down indicators & Back control */}
        {selectedCell ? (
          <button
            onClick={() => setSelectedCell(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Grid
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
            <ZoomIn className="w-3.5 h-3.5" />
            Click cell to drill-down
          </span>
        )}
      </div>

      {/* SVG Container */}
      <div ref={containerRef} className="w-full flex-grow relative min-h-[300px]">
        {binsData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            No rows match current filters.
          </div>
        )}
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className="block select-none"
        />
      </div>
    </div>
  );
}
