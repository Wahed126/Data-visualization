import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { fitPCAFromTable, projectRows } from "../utils/pca";

// Feature groups used to build the embedding space
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
const COMPOSITION_COLUMNS = ["Al", "Si", "Cu", "Ni", "Mg", "Mn", "Fe", "Cr", "Ti", "Zr", "V", "Zn"];
const PROPERTY_COLUMN_HINTS = [
  "eut. frac.[%]",
  "CSC",
  "YS(MPa)",
  "hardness(Vickers)",
  "Density(g/cm3)",
  "El.conductivity(S/m)",
  "Therm.conductivity(W/(mK))",
  "heat capacity(J/(mol K))",
  "delta_T",
  "T(liqu)",
  "T(sol)",
];

const FEATURE_SET_OPTIONS = [
  { key: "all", label: "All variables" },
  { key: "composition", label: "Composition (elements)" },
  { key: "phases", label: "Phases (Vf_...)" },
  { key: "properties", label: "Material properties" },
];

export default function EmbeddingView({
  table,
  data,
  filteredData,
  selectedIds,
  selectedColors,
  onToggleSelected,
  numericColumns,
  colorForColumnGroup,
  shortenLabel,
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 700, height: 480 });

  const [featureSet, setFeatureSet] = useState("all");
  const [colorColumn, setColorColumn] = useState(() => {
    return (
      ["YS(MPa)", "hardness(Vickers)", "Therm.conductivity(W/(mK))"].find((c) =>
        numericColumns.includes(c)
      ) || numericColumns[0]
    );
  });
  const [showDensity, setShowDensity] = useState(true);
  const [showLoadings, setShowLoadings] = useState(true);
  const [fitProgress, setFitProgress] = useState(0);
  // { key, model } — PCA model fitted on ALL table rows, cached per feature set
  const [pcaFit, setPcaFit] = useState(null);

  // Responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.max(width, 300), height: Math.max(height || 300, 300) });
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Resolve the feature columns for the chosen feature set
  const embeddingFeatures = useMemo(() => {
    if (featureSet === "composition") {
      return COMPOSITION_COLUMNS.filter((c) => numericColumns.includes(c));
    }
    if (featureSet === "phases") {
      return numericColumns.filter((c) => c.startsWith("Vf_"));
    }
    if (featureSet === "properties") {
      const matched = PROPERTY_COLUMN_HINTS.filter((c) => numericColumns.includes(c));
      return matched.length >= 3 ? matched : numericColumns.slice(-10);
    }
    // "all": everything numeric except redundant reciprocal columns
    return numericColumns.filter(
      (c) => !c.includes("resistivity") && !SCRAP_COLUMNS.includes(c)
    );
  }, [featureSet, numericColumns]);

  // Fit PCA on the FULL table (chunked, non-blocking); cache per feature set
  const fitKey = `${featureSet}|${table?.rowCount ?? 0}`;
  const pcaFitRef = useRef(null);
  useEffect(() => {
    pcaFitRef.current = pcaFit;
  }, [pcaFit]);
  useEffect(() => {
    if (!table || table.rowCount === 0 || embeddingFeatures.length < 3) return;
    if (pcaFitRef.current?.key === fitKey) return;
    let cancelled = false;
    fitPCAFromTable(
      table,
      embeddingFeatures,
      2,
      (fraction) => {
        if (!cancelled) setFitProgress(Math.round(fraction * 100));
      },
      () => cancelled
    ).then((model) => {
      if (!cancelled && model && model.loadings.length === 2) {
        setPcaFit({ key: fitKey, model });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [table, embeddingFeatures, fitKey]);

  const activeModel = pcaFit?.key === fitKey ? pcaFit.model : null;

  // Project the display sample onto the full-data components
  const scores = useMemo(() => {
    if (!activeModel || !data || data.length === 0) return null;
    return projectRows(data, activeModel);
  }, [activeModel, data]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || !data || !scores || scores.length !== data.length) return;

    const { width, height } = size;
    const margins = { top: 20, right: 24, bottom: 42, left: 52 };
    const innerWidth = width - margins.left - margins.right;
    const innerHeight = height - margins.top - margins.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const plot = svg.append("g").attr("transform", `translate(${margins.left},${margins.top})`);

    const xExtent = d3.extent(scores, (s) => s[0]);
    const yExtent = d3.extent(scores, (s) => s[1]);
    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]).nice();
    const yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]).nice();

    // Color scale over the selected property
    const colorExtent = d3.extent(data, (d) =>
      Number.isFinite(d[colorColumn]) ? d[colorColumn] : undefined
    );
    const colorScale = d3
      .scaleSequential(d3.interpolateViridis)
      .domain([colorExtent[0] ?? 0, colorExtent[1] ?? 1]);

    const filteredIds = new Set(filteredData.map((d) => d.__id));

    // Axes
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 34)
      .attr("fill", "#475569")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .text(`PC1 (${((activeModel?.explainedVariance[0] ?? 0) * 100).toFixed(1)}% variance)`);
    plot
      .append("g")
      .call(d3.axisLeft(yScale).ticks(6))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -38)
      .attr("fill", "#475569")
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .text(`PC2 (${((activeModel?.explainedVariance[1] ?? 0) * 100).toFixed(1)}% variance)`);

    // KDE density contours computed on the filtered subset only, so the
    // density visualization follows the coordinated brushing
    if (showDensity) {
      const indexed = data
        .map((d, idx) => ({ d, idx }))
        .filter(({ d }) => filteredIds.has(d.__id));
      const contours = d3
        .contourDensity()
        .x((item) => xScale(scores[item.idx][0]))
        .y((item) => yScale(scores[item.idx][1]))
        .size([innerWidth, innerHeight])
        .bandwidth(14)
        .thresholds(12)(indexed);

      plot
        .append("g")
        .attr("class", "kde-contours")
        .selectAll("path")
        .data(contours)
        .enter()
        .append("path")
        .attr("d", d3.geoPath())
        .attr("fill", "none")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", (d, i) => (i % 4 === 0 ? 0.9 : 0.4))
        .attr("stroke-opacity", 0.6);
    }

    // Points (display sample; statistics and axes derive from all rows)
    plot
      .append("g")
      .attr("class", "embedding-points")
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => xScale(scores[i][0]))
      .attr("cy", (d, i) => yScale(scores[i][1]))
      .attr("r", (d) => (selectedIds.includes(d.__id) ? 6 : 1.8))
      .attr("fill", (d) => {
        if (selectedIds.includes(d.__id)) return selectedColors[d.__id];
        if (!filteredIds.has(d.__id)) return "#e2e8f0";
        return Number.isFinite(d[colorColumn]) ? colorScale(d[colorColumn]) : "#cbd5e1";
      })
      .attr("stroke", (d) => (selectedIds.includes(d.__id) ? "#0f172a" : "none"))
      .attr("stroke-width", 1.5)
      .attr("opacity", (d) => {
        if (selectedIds.includes(d.__id)) return 1;
        return filteredIds.has(d.__id) ? 0.55 : 0.12;
      })
      .style("cursor", "pointer")
      .on("click", (event, d) => onToggleSelected(d.__id))
      .append("title")
      .text(
        (d) =>
          `${d.__label}\n${colorColumn}: ${Number.isFinite(d[colorColumn]) ? d[colorColumn].toFixed(2) : "n/a"}`
      );

    // Loading vectors (biplot arrows): which variables drive the axes
    if (showLoadings && activeModel) {
      const { loadings, features } = activeModel;
      const magnitudes = features.map((feature, j) => ({
        feature,
        l1: loadings[0][j],
        l2: loadings[1][j],
        magnitude: Math.hypot(loadings[0][j], loadings[1][j]),
      }));
      const topLoadings = magnitudes
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 10);

      const arrowScale = 0.42 * Math.min(innerWidth, innerHeight);
      const centerX = xScale(0);
      const centerY = yScale(0);
      const maxMagnitude = d3.max(topLoadings, (l) => l.magnitude) || 1;

      const arrowGroup = plot.append("g").attr("class", "pca-loadings");
      topLoadings.forEach((loading) => {
        const dx = (loading.l1 / maxMagnitude) * arrowScale;
        const dy = -(loading.l2 / maxMagnitude) * arrowScale;
        arrowGroup
          .append("line")
          .attr("x1", centerX)
          .attr("y1", centerY)
          .attr("x2", centerX + dx)
          .attr("y2", centerY + dy)
          .attr("stroke", colorForColumnGroup(loading.feature))
          .attr("stroke-width", 1.4)
          .attr("stroke-opacity", 0.85)
          .attr("marker-end", "url(#loading-arrowhead)");
        arrowGroup
          .append("text")
          .attr("x", centerX + dx * 1.08)
          .attr("y", centerY + dy * 1.08)
          .attr("fill", colorForColumnGroup(loading.feature))
          .attr("text-anchor", dx >= 0 ? "start" : "end")
          .style("font-size", "10px")
          .style("font-weight", "700")
          .style("paint-order", "stroke")
          .style("stroke", "white")
          .style("stroke-width", "3px")
          .text(shortenLabel(loading.feature, 14));
      });

      svg
        .append("defs")
        .append("marker")
        .attr("id", "loading-arrowhead")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 8)
        .attr("refY", 5)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto-start-reverse")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", "#334155");
    }

    // Color legend
    const legendWidth = 140;
    const legendHeight = 8;
    const legendGroup = svg
      .append("g")
      .attr("transform", `translate(${width - legendWidth - 20},${8})`);
    const legendScale = d3
      .scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);
    const gradientId = "embedding-color-gradient";
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", gradientId);
    d3.range(0, 1.01, 0.1).forEach((t) => {
      gradient
        .append("stop")
        .attr("offset", `${t * 100}%`)
        .attr(
          "stop-color",
          colorScale(colorScale.domain()[0] + t * (colorScale.domain()[1] - colorScale.domain()[0]))
        );
    });
    legendGroup
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 2)
      .attr("fill", `url(#${gradientId})`);
    legendGroup
      .append("g")
      .attr("transform", `translate(0,${legendHeight})`)
      .call(d3.axisBottom(legendScale).ticks(3).tickSize(3))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "9px");
    legendGroup
      .append("text")
      .attr("y", -4)
      .attr("fill", "#64748b")
      .style("font-size", "9px")
      .style("font-weight", "600")
      .text(shortenLabel(colorColumn, 24));
  }, [
    size,
    data,
    filteredData,
    scores,
    activeModel,
    colorColumn,
    showDensity,
    showLoadings,
    selectedIds,
    selectedColors,
    onToggleSelected,
    colorForColumnGroup,
    shortenLabel,
  ]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] mb-2">
        <label className="flex items-center gap-1.5 font-medium text-slate-500">
          Features:
          <select
            value={featureSet}
            onChange={(e) => setFeatureSet(e.target.value)}
            className="control-select text-[11px]"
          >
            {FEATURE_SET_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 font-medium text-slate-500">
          Color by:
          <select
            value={colorColumn}
            onChange={(e) => setColorColumn(e.target.value)}
            className="control-select text-[11px] max-w-[180px]"
          >
            {numericColumns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 font-medium text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showDensity}
            onChange={(e) => setShowDensity(e.target.checked)}
          />
          KDE contours
        </label>

        <label className="flex items-center gap-1 font-medium text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showLoadings}
            onChange={(e) => setShowLoadings(e.target.checked)}
          />
          Loading vectors
        </label>
      </div>

      {/* Chart / progress */}
      <div ref={containerRef} className="grow relative min-h-[320px]">
        {!activeModel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${fitProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold">
              Fitting PCA on all {table?.rowCount?.toLocaleString() ?? ""} alloys… {fitProgress}%
            </span>
          </div>
        ) : (
          <svg ref={svgRef} width={size.width} height={size.height} className="block select-none" />
        )}
      </div>
    </div>
  );
}
