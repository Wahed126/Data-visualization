import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function ParallelCoordinates({
  data,
  filteredData,
  dimensions,
  brushes,
  onBrushChange,
  colorForColumnGroup,
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
      // Keep a minimum size and aspect ratio
      setSize({
        width: Math.max(width, 400),
        height: Math.max(height || 360, 360),
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !dimensions || dimensions.length === 0 || !data) return;

    const { width, height } = size;
    const margins = { top: 55, right: 30, bottom: 80, left: 50 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    // Clear SVG content
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create main drawing group
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margins.left},${margins.top})`);

    // Define Scale Point for dimensions on X axis
    const xScale = d3
      .scalePoint()
      .domain(dimensions)
      .range([0, innerWidth])
      .padding(0.35);

    // Create Y scales for each dimension
    const yScales = {};
    dimensions.forEach((dimension) => {
      const extent = d3.extent(data, (d) =>
        Number.isFinite(d[dimension]) ? d[dimension] : undefined
      );
      
      // Fallback in case of empty or invalid extent
      const min = extent[0] !== undefined ? extent[0] : 0;
      const max = extent[1] !== undefined ? extent[1] : 1;
      
      yScales[dimension] = d3
        .scaleLinear()
        .domain([min, max])
        .range([innerHeight, 0])
        .nice();
    });

    // Helper to calculate line path for an alloy row
    const lineGenerator = d3.line();
    const pathForRow = (row) => {
      const coords = dimensions.map((dimension) => {
        const value = row[dimension];
        return [
          xScale(dimension),
          Number.isFinite(value) ? yScales[dimension](value) : innerHeight,
        ];
      });
      return lineGenerator(coords);
    };

    // Filtered IDs set for fast check
    const filteredIds = new Set(filteredData.map((d) => d.__id));

    // Render PCP lines
    const lineGroup = plot.append("g").attr("class", "parallel-lines");
    
    // Split data into valid and invalid to render only fully defined records
    const validRows = data.filter((row) =>
      dimensions.every((dim) => Number.isFinite(row[dim]))
    );

    const paths = lineGroup
      .selectAll("path")
      .data(validRows, (d) => d.__id)
      .enter()
      .append("path")
      .attr("class", "pcp-line")
      .attr("d", pathForRow)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        // Color lines based on the first brushed or prominent dimension group
        // If not filtered, render in soft grey
        if (!filteredIds.has(d.__id)) return "#e2e8f0";
        // Default color for active lines
        return "#3b82f6";
      })
      .attr("stroke-width", (d) => (filteredIds.has(d.__id) ? 1.0 : 0.5))
      .attr("opacity", (d) => (filteredIds.has(d.__id) ? 0.35 : 0.05));

    // Render Axes
    const axes = plot
      .selectAll(".pcp-axis")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("class", "pcp-axis")
      .attr("transform", (dimension) => `translate(${xScale(dimension)},0)`);

    // Draw Y axis scales
    axes.each(function (dimension) {
      d3.select(this).call(d3.axisLeft(yScales[dimension]).ticks(5));
    });

    // Draw dimension labels rotate -30 for layout
    axes
      .append("text")
      .attr("class", "pcp-axis-label font-medium")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-30)")
      .attr("x", -10)
      .attr("y", -8)
      .attr("fill", (dimension) => colorForColumnGroup(dimension))
      .style("font-size", "11px")
      .text((dimension) => shortenLabel(dimension, 15));

    // Implement brushing
    axes.each(function (dimension) {
      const brushGroup = d3.select(this).append("g").attr("class", "pcp-brush");

      const yBrushing = d3
        .brushY()
        .extent([
          [-12, 0],
          [12, innerHeight],
        ]);

      // Bind the brush to the group first
      brushGroup.call(yBrushing);

      // Initialize existing brush state if present
      if (brushes[dimension]) {
        const selectionRange = [
          yScales[dimension](brushes[dimension][1]), // max maps to smaller Y pixel coord
          yScales[dimension](brushes[dimension][0]), // min maps to larger Y pixel coord
        ];
        brushGroup.call(yBrushing.move, selectionRange);
      }

      // Handle brush changes
      yBrushing.on("brush end", (event) => {
        let activeRange = null;

        if (event.selection) {
          const [y1, y2] = event.selection;
          // Invert back to data values (yScales range is [innerHeight, 0])
          const valMin = yScales[dimension].invert(y2);
          const valMax = yScales[dimension].invert(y1);
          activeRange = [valMin, valMax];
        }

        // We only trigger update on "end" or conditionally "brush"
        // Let's call the callback to let React update its state
        if (event.type === "end") {
          onBrushChange(dimension, activeRange);
        } else if (event.type === "brush") {
          // Instant feedback inside PCP without triggering React state cascade during drag
          const tempBrushes = { ...brushes };
          if (activeRange) {
            tempBrushes[dimension] = activeRange;
          } else {
            delete tempBrushes[dimension];
          }

          // Calculate what would remain filtered
          const tempFilteredIds = new Set(
            data
              .filter((row) => {
                return Object.keys(tempBrushes).every((dim) => {
                  const val = row[dim];
                  const range = tempBrushes[dim];
                  return Number.isFinite(val) && val >= range[0] && val <= range[1];
                });
              })
              .map((d) => d.__id)
          );

          // Instantly update PCP lines styles
          paths
            .attr("stroke", (d) => (tempFilteredIds.has(d.__id) ? "#3b82f6" : "#e2e8f0"))
            .attr("stroke-width", (d) => (tempFilteredIds.has(d.__id) ? 1.0 : 0.5))
            .attr("opacity", (d) => (tempFilteredIds.has(d.__id) ? 0.35 : 0.05));
        }
      });
    });
  }, [size, dimensions, data, filteredData, brushes, colorForColumnGroup, onBrushChange, shortenLabel]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="block select-none"
      />
    </div>
  );
}
