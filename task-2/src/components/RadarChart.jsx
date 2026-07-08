import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function RadarChart({
  data,
  selectedIds,
  selectedColors,
  onToggleSelected,
  dimensions,
  shortenLabel,
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
        width: Math.max(width, 200),
        height: Math.max(height || 200, 200),
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !dimensions || dimensions.length < 3 || !data) return;

    const { width, height } = size;
    const plotRadius = Math.min(width, height) * 0.35;
    const centerX = width / 2;
    const centerY = height / 2;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg
      .append("g")
      .attr("transform", `translate(${centerX},${centerY})`);

    const selectedRows = selectedIds
      .map((id) => data.find((d) => d.__id === id))
      .filter(Boolean);

    if (selectedRows.length === 0) {
      plot
        .append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "#94a3b8")
        .style("font-size", "12px")
        .text("Click alloys in the embedding or heatmap drill-down to compare");
      return;
    }

    const angleStep = (Math.PI * 2) / dimensions.length;

    // Define linear scale for each dimension based on full data range
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
        .range([0, plotRadius]);
    });

    // Radial line generator
    const radarLine = d3
      .lineRadial()
      .radius((point) => scales[point.dimension](point.value))
      .angle((point) => point.index * angleStep)
      .curve(d3.curveLinearClosed);

    // Draw concentric level circles (4 circles)
    d3.range(1, 5).forEach((level) => {
      const r = (plotRadius * level) / 4;
      plot
        .append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1);

      // Add a small label for the outermost level
      if (level === 4) {
        plot
          .append("text")
          .attr("x", 4)
          .attr("y", -r - 2)
          .attr("fill", "#94a3b8")
          .style("font-size", "9px")
          .text("100%");
      }
    });

    // Draw axes lines and labels
    dimensions.forEach((dimension, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const axisX = plotRadius * Math.cos(angle);
      const axisY = plotRadius * Math.sin(angle);

      // Axis line
      plot
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", axisX)
        .attr("y2", axisY)
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 1);

      // Text placement details
      const labelDistance = plotRadius + 14;
      const labelX = labelDistance * Math.cos(angle);
      const labelY = labelDistance * Math.sin(angle);

      const isVertical = Math.abs(Math.cos(angle)) < 0.2;
      const textAnchor = isVertical ? "middle" : Math.cos(angle) > 0 ? "start" : "end";

      plot
        .append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("text-anchor", textAnchor)
        .attr("alignment-baseline", "middle")
        .attr("fill", "#475569")
        .style("font-size", "10px")
        .style("font-weight", "500")
        .text(shortenLabel(dimension, 15));
    });

    // Build shape objects
    const radarShapesData = selectedRows.map((row) => ({
      id: row.__id,
      values: dimensions.map((dimension, index) => ({
        dimension,
        index,
        value: Number.isFinite(row[dimension]) ? row[dimension] : 0,
      })),
    }));

    // Draw Radar shapes
    plot
      .selectAll(".radar-shape")
      .data(radarShapesData, (d) => d.id)
      .enter()
      .append("path")
      .attr("class", "radar-shape")
      .attr("d", (d) => radarLine(d.values))
      .attr("fill", (d) => selectedColors[d.id])
      .attr("fill-opacity", 0.05)
      .attr("stroke", (d) => selectedColors[d.id])
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.05))");
  }, [size, data, selectedIds, selectedColors, dimensions, shortenLabel]);

  // Selected candidate list
  const selectedRows = selectedIds
    .map((id) => data.find((d) => d.__id === id))
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Selected candidate chips (kept inside the card flow, wraps as needed) */}
      {selectedRows.length > 0 && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Candidates {selectedRows.length}/5
          </span>
          {selectedRows.map((row) => (
            <span
              key={row.__id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 bg-white border border-slate-200 rounded-full shadow-sm text-[11px] font-medium text-slate-700"
              style={{ borderColor: selectedColors[row.__id] }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedColors[row.__id] }}
              />
              {row.__label}
              <button
                onClick={() => onToggleSelected(row.__id)}
                className="w-4 h-4 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold cursor-pointer transition-colors leading-none"
                title="Remove alloy"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* SVG Container — min-w-0/overflow-hidden let flexbox shrink it instead
          of pushing siblings out of the card */}
      <div ref={containerRef} className="flex-grow relative min-h-[220px] min-w-0 overflow-hidden">
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className="block select-none mx-auto"
        />
      </div>
    </div>
  );
}
