import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

export default function JointDensityHeatmap({
  filteredData,
  numericColumns,
  xCol,
  setXCol,
  yCol,
  setYCol,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 400 });

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

  // Filter rows
  const validRows = useMemo(() => {
    return filteredData.filter(
      (row) => Number.isFinite(row[xCol]) && Number.isFinite(row[yCol])
    );
  }, [filteredData, xCol, yCol]);

  // Compute extents
  const bounds = useMemo(() => {
    if (validRows.length === 0) return null;
    const xExtent = d3.extent(validRows, (d) => d[xCol]);
    const yExtent = d3.extent(validRows, (d) => d[yCol]);
    return {
      xRange: xExtent[0] === xExtent[1] ? [xExtent[0] - 1, xExtent[0] + 1] : xExtent,
      yRange: yExtent[0] === yExtent[1] ? [yExtent[0] - 1, yExtent[0] + 1] : yExtent,
    };
  }, [validRows, xCol, yCol]);

  const GRID_SIZE = 15;

  // Grid binning
  const binsData = useMemo(() => {
    if (!bounds || validRows.length === 0) return [];

    const binXScale = d3.scaleLinear().domain(bounds.xRange).range([0, GRID_SIZE]);
    const binYScale = d3.scaleLinear().domain(bounds.yRange).range([0, GRID_SIZE]);

    const grid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => 0)
    );

    validRows.forEach((row) => {
      let colIdx = Math.floor(binXScale(row[xCol]));
      let rowIdx = Math.floor(binYScale(row[yCol]));

      colIdx = Math.max(0, Math.min(GRID_SIZE - 1, colIdx));
      rowIdx = Math.max(0, Math.min(GRID_SIZE - 1, rowIdx));

      grid[rowIdx][colIdx] += 1;
    });

    const flatBins = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const count = grid[r][c];
        if (count > 0) {
          flatBins.push({ row: r, col: c, count });
        }
      }
    }
    return flatBins;
  }, [validRows, bounds, xCol, yCol]);

  useEffect(() => {
    if (!svgRef.current || !bounds || validRows.length === 0) return;

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

    // Axis titles
    plot
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text(xCol);

    plot
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text(yCol);

    // Color: Log scale for joint density (orange to deep red gradient)
    const maxCount = d3.max(binsData, (d) => d.count) || 1;
    const colorScale = d3
      .scaleLog()
      .domain([1, maxCount])
      .range(["#ffedd5", "#ea580c"]); // orange-50 to orange-600

    const cellW = innerWidth / GRID_SIZE;
    const cellH = innerHeight / GRID_SIZE;

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

    // Draw bins
    plot
      .append("g")
      .attr("class", "joint-cells")
      .selectAll("rect")
      .data(binsData)
      .enter()
      .append("rect")
      .attr("x", (d) => xScale(bounds.xRange[0] + (d.col * (bounds.xRange[1] - bounds.xRange[0])) / GRID_SIZE))
      .attr("y", (d) => yScale(bounds.yRange[0] + ((d.row + 1) * (bounds.yRange[1] - bounds.yRange[0])) / GRID_SIZE))
      .attr("width", cellW - 0.5)
      .attr("height", cellH - 0.5)
      .attr("fill", (d) => colorScale(d.count))
      .attr("opacity", 0.95)
      .on("mouseover", (event, d) => {
        // Calculate cell center values for context
        const xVal = bounds.xRange[0] + ((d.col + 0.5) * (bounds.xRange[1] - bounds.xRange[0])) / GRID_SIZE;
        const yVal = bounds.yRange[0] + ((d.row + 0.5) * (bounds.yRange[1] - bounds.yRange[0])) / GRID_SIZE;

        tooltip
          .style("opacity", 1)
          .html(
            `<div><strong>Joint Frequency</strong></div>` +
              `<div><strong>Alloys</strong>: ${d.count}</div>` +
              `<div><strong>Approx ${xCol}</strong>: ${formatValue(xVal)}</div>` +
              `<div><strong>Approx ${yCol}</strong>: ${formatValue(yVal)}</div>`
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });
  }, [size, bounds, binsData, xCol, yCol, validRows]);

  return (
    <div className="flex flex-col h-full">
      {/* Visual Channel Dropdowns */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">X Variable:</span>
          <select
            value={xCol}
            onChange={(e) => setXCol(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[130px] truncate"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Y Variable:</span>
          <select
            value={yCol}
            onChange={(e) => setYCol(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[130px] truncate"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SVG Container */}
      <div ref={containerRef} className="w-full flex-grow relative min-h-[300px]">
        {validRows.length === 0 && (
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
