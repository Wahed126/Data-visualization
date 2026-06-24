import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function Histogram({
  filteredData,
  numericColumns,
  histogramColumn,
  setHistogramColumn,
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
    if (!svgRef.current || !filteredData || !histogramColumn) return;

    const { width, height } = size;
    const margins = { top: 25, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margins.left},${margins.top})`);

    // Extract values for the chosen column
    const values = filteredData
      .map((row) => row[histogramColumn])
      .filter(Number.isFinite);

    if (values.length === 0) {
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

    // Define X scale based on min/max of values
    const extent = d3.extent(values);
    const xRange = extent[0] === extent[1] ? [extent[0] - 1, extent[0] + 1] : extent;
    const xScale = d3.scaleLinear().domain(xRange).range([0, innerWidth]).nice();

    // Define binning
    const histogram = d3
      .bin()
      .domain(xScale.domain())
      .thresholds(30); // 30 bins as specified in dashboard.js

    const bins = histogram(values);

    // Define Y scale
    const maxCount = d3.max(bins, (d) => d.length) || 1;
    const yScale = d3.scaleLinear().domain([0, maxCount]).range([innerHeight, 0]).nice();

    // Draw gridlines
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

    // Draw Labels
    plot
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 40)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text(histogramColumn);

    plot
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text("Count");

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

    // Draw Bars
    const bars = plot.selectAll(".histogram-bar").data(bins);

    bars
      .enter()
      .append("rect")
      .attr("class", "histogram-bar")
      .attr("x", (d) => xScale(d.x0) + 1)
      .attr("y", innerHeight)
      .attr("width", (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
      .attr("height", 0)
      .attr("fill", "#fb923c") // Amber/orange minimal light mode theme
      .attr("stroke", "#f97316")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.8)
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<div><strong>Range</strong>: [${formatValue(d.x0)}, ${formatValue(d.x1)}]</div>` +
              `<div><strong>Count</strong>: ${d.length}</div>`
          );
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
      .attr("y", (d) => yScale(d.length))
      .attr("height", (d) => innerHeight - yScale(d.length));

    // Update existing bars
    bars
      .transition()
      .duration(500)
      .attr("x", (d) => xScale(d.x0) + 1)
      .attr("y", (d) => yScale(d.length))
      .attr("width", (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
      .attr("height", (d) => innerHeight - yScale(d.length));

    // Exit bars
    bars.exit().transition().duration(300).attr("y", innerHeight).attr("height", 0).remove();
  }, [size, filteredData, histogramColumn]);

  return (
    <div className="flex flex-col h-full">
      {/* Selector dropdown */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Distribution of:</span>
          <select
            value={histogramColumn}
            onChange={(e) => setHistogramColumn(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-medium max-w-[200px] truncate"
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
