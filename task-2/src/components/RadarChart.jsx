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
        width: Math.max(width, 400),
        height: Math.max(height || 360, 360),
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
        .attr("fill", "#64748b")
        .style("font-size", "14px")
        .text("Click points in the scatter/bubble chart to compare alloys");
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
    <div className="flex flex-col md:flex-row h-full items-stretch">
      {/* SVG Container */}
      <div ref={containerRef} className="flex-grow relative min-h-[300px]">
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          className="block select-none mx-auto"
        />
      </div>

      {/* Interactive Legend Side Panel */}
      {selectedRows.length > 0 && (
        <div className="w-full md:w-56 shrink-0 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 p-4 bg-slate-50/50">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Selected Candidates
          </div>
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            {selectedRows.map((row) => (
              <div
                key={row.__id}
                className="flex items-center justify-between gap-2 p-1.5 bg-white border border-slate-200/60 rounded-md shadow-sm text-xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: selectedColors[row.__id] }}
                  />
                  <span className="font-medium text-slate-700 truncate">{row.__label}</span>
                </div>
                <button
                  onClick={() => onToggleSelected(row.__id)}
                  className="w-4 h-4 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                  title="Remove alloy"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 mt-3 italic">
            Showing {selectedRows.length} of 5 max. Compare properties radial layout.
          </div>
        </div>
      )}
    </div>
  );
}
