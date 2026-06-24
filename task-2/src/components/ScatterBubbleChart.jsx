import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function ScatterBubbleChart({
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

  useEffect(() => {
    if (!svgRef.current || !filteredData || !xColumn || !yColumn || !sizeColumn) return;

    const { width, height } = size;
    const margins = { top: 25, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margins.left},${margins.top})`);

    // Filter rows that have finite numbers in all chosen columns
    const chartRows = filteredData
      .filter((row) =>
        Number.isFinite(row[xColumn]) &&
        Number.isFinite(row[yColumn]) &&
        Number.isFinite(row[sizeColumn])
      )
      .slice(0, 2000); // limit to 2000 points for excellent performance

    if (chartRows.length === 0) {
      plot
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .style("font-size", "14px")
        .text("No data fits current selection/filters");
      return;
    }

    // Set scales
    const xExtent = d3.extent(chartRows, (d) => d[xColumn]);
    const yExtent = d3.extent(chartRows, (d) => d[yColumn]);
    const sizeExtent = d3.extent(chartRows, (d) => d[sizeColumn]);

    // Handle single value edge case
    const xRange = xExtent[0] === xExtent[1] ? [xExtent[0] - 1, xExtent[0] + 1] : xExtent;
    const yRange = yExtent[0] === yExtent[1] ? [yExtent[0] - 1, yExtent[0] + 1] : yExtent;
    const sizeRange = sizeExtent[0] === sizeExtent[1] ? [sizeExtent[0] - 1, sizeExtent[0] + 1] : sizeExtent;

    const xScale = d3.scaleLinear().domain(xRange).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(yRange).range([innerHeight, 0]).nice();
    const sizeScale = d3.scaleSqrt().domain(sizeRange).range([3, 12]);

    // Draw gridlines
    plot
      .append("g")
      .attr("class", "grid text-slate-100")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(""))
      .style("stroke-dasharray", "3,3");

    plot
      .append("g")
      .attr("class", "grid text-slate-100")
      .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(""))
      .style("stroke-dasharray", "3,3");

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

    // Draw axis titles
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

    // Get or Create Tooltip
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    }

    // Helper to format values
    const formatValue = (v) => (Number.isFinite(v) ? d3.format(".4~g")(v) : v);

    // Render Dots
    const dots = plot
      .selectAll(".dashboard-dot")
      .data(chartRows, (d) => d.__id);

    dots
      .enter()
      .append("circle")
      .attr("class", "dashboard-dot")
      .attr("cx", (d) => xScale(d[xColumn]))
      .attr("cy", (d) => yScale(d[yColumn]))
      .attr("r", 0)
      .attr("fill", (d) => (selectedIds.includes(d.__id) ? selectedColors[d.__id] : "#64748b"))
      .attr("stroke", (d) => (selectedIds.includes(d.__id) ? "#0f172a" : "none"))
      .attr("stroke-width", (d) => (selectedIds.includes(d.__id) ? 2 : 0))
      .attr("opacity", (d) => (selectedIds.includes(d.__id) ? 0.95 : 0.25))
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
          .html(`<div><strong>${d.__label}</strong></div>${htmlDetails}`);
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`);
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      })
      .transition()
      .duration(500)
      .attr("r", (d) => sizeScale(d[sizeColumn]));

    // Update existing dots
    dots
      .transition()
      .duration(500)
      .attr("cx", (d) => xScale(d[xColumn]))
      .attr("cy", (d) => yScale(d[yColumn]))
      .attr("r", (d) => sizeScale(d[sizeColumn]))
      .attr("fill", (d) => (selectedIds.includes(d.__id) ? selectedColors[d.__id] : "#64748b"))
      .attr("stroke", (d) => (selectedIds.includes(d.__id) ? "#0f172a" : "none"))
      .attr("stroke-width", (d) => (selectedIds.includes(d.__id) ? 2 : 0))
      .attr("opacity", (d) => (selectedIds.includes(d.__id) ? 0.95 : 0.25));

    // Exit old dots
    dots.exit().transition().duration(300).attr("r", 0).remove();
  }, [size, filteredData, xColumn, yColumn, sizeColumn, selectedIds, selectedColors, radarDimensions, onToggleSelected]);

  return (
    <div className="flex flex-col h-full">
      {/* Visual Channel Dropdowns */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">X Axis:</span>
          <select
            value={xColumn}
            onChange={(e) => setXColumn(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[140px] truncate"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Y Axis:</span>
          <select
            value={yColumn}
            onChange={(e) => setYColumn(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[140px] truncate"
          >
            {numericColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Bubble Size:</span>
          <select
            value={sizeColumn}
            onChange={(e) => setSizeColumn(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[140px] truncate"
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
