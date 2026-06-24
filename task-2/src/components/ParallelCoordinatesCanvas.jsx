import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function ParallelCoordinatesCanvas({
  data,
  filteredData,
  dimensions,
  brushes,
  onBrushChange,
  colorForColumnGroup,
  shortenLabel,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
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
    if (!canvasRef.current || !svgRef.current || !dimensions || dimensions.length === 0 || !data) return;

    const { width, height } = size;
    const margins = { top: 55, right: 30, bottom: 80, left: 50 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    // --- CANVAS RENDERING (High performance, low-alpha density mapping) ---
    const canvas = canvasRef.current;
    // Set canvas internal resolution to match device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Setup scales
    const xScale = d3
      .scalePoint()
      .domain(dimensions)
      .range([0, innerWidth])
      .padding(0.35);

    const yScales = {};
    dimensions.forEach((dimension) => {
      const extent = d3.extent(data, (d) =>
        Number.isFinite(d[dimension]) ? d[dimension] : undefined
      );
      const min = extent[0] !== undefined ? extent[0] : 0;
      const max = extent[1] !== undefined ? extent[1] : 1;
      
      yScales[dimension] = d3
        .scaleLinear()
        .domain([min, max])
        .range([innerHeight, 0])
        .nice();
    });

    const filteredIds = new Set(filteredData.map((d) => d.__id));

    // Extract valid rows (all axes finite)
    const validRows = data.filter((row) =>
      dimensions.every((dim) => Number.isFinite(row[dim]))
    );

    // Draw lines on Canvas
    // Step 1: Draw inactive/filtered out lines in very faint gray
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = "rgba(226, 232, 240, 0.04)"; // ultra-faint gray
    validRows.forEach((row) => {
      if (filteredIds.has(row.__id)) return; // Skip active lines for now
      
      ctx.beginPath();
      dimensions.forEach((dimension, index) => {
        const x = xScale(dimension) + margins.left;
        const y = yScales[dimension](row[dimension]) + margins.top;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // Step 2: Draw active lines in alpha blue to accumulate density bands
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = "rgba(37, 99, 235, 0.035)"; // low-alpha blue for density stacking
    validRows.forEach((row) => {
      if (!filteredIds.has(row.__id)) return;

      ctx.beginPath();
      dimensions.forEach((dimension, index) => {
        const x = xScale(dimension) + margins.left;
        const y = yScales[dimension](row[dimension]) + margins.top;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // --- SVG INTERACTION OVERLAY (Axes, rotated text labels, and brushes) ---
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg
      .append("g")
      .attr("transform", `translate(${margins.left},${margins.top})`);

    const axes = plot
      .selectAll(".pcp-axis")
      .data(dimensions)
      .enter()
      .append("g")
      .attr("class", "pcp-axis")
      .attr("transform", (dimension) => `translate(${xScale(dimension)},0)`);

    // Draw axis lines and ticks
    axes.each(function (dimension) {
      d3.select(this).call(d3.axisLeft(yScales[dimension]).ticks(5));
    });

    // Add labels
    axes
      .append("text")
      .attr("class", "pcp-axis-label font-semibold")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-30)")
      .attr("x", -10)
      .attr("y", -8)
      .attr("fill", (dimension) => colorForColumnGroup(dimension))
      .style("font-size", "11px")
      .text((dimension) => shortenLabel(dimension, 15));

    // Bind brushing interaction
    axes.each(function (dimension) {
      const brushGroup = d3.select(this).append("g").attr("class", "pcp-brush");

      const yBrushing = d3
        .brushY()
        .extent([
          [-12, 0],
          [12, innerHeight],
        ]);

      brushGroup.call(yBrushing);

      // Restore active brush selections
      if (brushes[dimension]) {
        const selectionRange = [
          yScales[dimension](brushes[dimension][1]),
          yScales[dimension](brushes[dimension][0]),
        ];
        brushGroup.call(yBrushing.move, selectionRange);
      }

      yBrushing.on("brush end", (event) => {
        let activeRange = null;

        if (event.selection) {
          const [y1, y2] = event.selection;
          const valMin = yScales[dimension].invert(y2);
          const valMax = yScales[dimension].invert(y1);
          activeRange = [valMin, valMax];
        }

        if (event.type === "end") {
          onBrushChange(dimension, activeRange);
        } else if (event.type === "brush") {
          // Instant local redraw on Canvas during active brush drag
          const tempBrushes = { ...brushes };
          if (activeRange) {
            tempBrushes[dimension] = activeRange;
          } else {
            delete tempBrushes[dimension];
          }

          const tempFilteredIds = new Set(
            data
              .filter((row) =>
                Object.keys(tempBrushes).every((dim) => {
                  const val = row[dim];
                  const range = tempBrushes[dim];
                  return Number.isFinite(val) && val >= range[0] && val <= range[1];
                })
              )
              .map((d) => d.__id)
          );

          // Clear and redraw canvas instantly for real-time drag feedback
          ctx.clearRect(0, 0, width, height);

          // Draw inactive lines
          ctx.lineWidth = 0.85;
          ctx.strokeStyle = "rgba(226, 232, 240, 0.04)";
          validRows.forEach((row) => {
            if (tempFilteredIds.has(row.__id)) return;
            ctx.beginPath();
            dimensions.forEach((dim, idx) => {
              const x = xScale(dim) + margins.left;
              const y = yScales[dim](row[dim]) + margins.top;
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
          });

          // Draw active lines
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = "rgba(37, 99, 235, 0.035)";
          validRows.forEach((row) => {
            if (!tempFilteredIds.has(row.__id)) return;
            ctx.beginPath();
            dimensions.forEach((dim, idx) => {
              const x = xScale(dim) + margins.left;
              const y = yScales[dim](row[dim]) + margins.top;
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.stroke();
          });
        }
      });
    });
  }, [size, dimensions, data, filteredData, brushes, colorForColumnGroup, onBrushChange, shortenLabel]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: "360px" }}>
      {/* Canvas for rendering thousands of lines efficiently */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />
      {/* SVG for axes and brushing interactions */}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="absolute inset-0 block select-none z-10 bg-transparent"
      />
    </div>
  );
}
