/**
 * candidateExplorer.js
 * Scatter / Bubble Chart — Candidate Explorer.
 *
 * Listens: brushChange (filter by value ranges), pointSelected (highlight selected dot)
 * Emits:   pointSelected (on dot click)
 *
 * Uses named listener refs + appState.off() so axis-change redraws don't stack listeners.
 * Does NOT touch pointSelected listeners — those belong to radarChart / barChart.
 *
 * NOTE: scatter/bubble data now includes element + property columns from the backend,
 * so a clicked point's full profile is always available for the Alloy Profile view.
 */

let _ce_brushListener = null;
let _ce_pointListener = null;

function drawCandidateExplorer(data, containerSelector, xCol, yCol, zCol = null, colorCol = null) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Remove only this chart's own listeners — do NOT touch others' listeners
    if (_ce_brushListener) appState.off("brushChange",  _ce_brushListener);
    if (_ce_pointListener) appState.off("pointSelected", _ce_pointListener);

    const margin = { top: 20, right: 30, bottom: 50, left: 65 };
    const width  = container.node().clientWidth  - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top  - margin.bottom;

    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // ── Scales ────────────────────────────────────────────────────────────────
    const xDomain = d3.extent(data, d => d[xCol]);
    const yDomain = d3.extent(data, d => d[yCol]);
    const xPad = (xDomain[1] - xDomain[0]) * 0.05 || 1;
    const yPad = (yDomain[1] - yDomain[0]) * 0.05 || 1;

    const x = d3.scaleLinear()
        .domain([xDomain[0] - xPad, xDomain[1] + xPad])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([yDomain[0] - yPad, yDomain[1] + yPad])
        .range([height, 0]);

    let zRadius = () => 4;
    if (zCol) {
        const zDomain = d3.extent(data, d => d[zCol]);
        const zScale  = d3.scaleSqrt().domain(zDomain).range([2, 14]);
        zRadius = d => zScale(d[zCol]);
    }

    let colorScale = () => "var(--chart-1)";
    if (colorCol) {
        const isNumerical = typeof data[0][colorCol] === "number";
        colorScale = isNumerical
            ? d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(data, d => d[colorCol]))
            : d3.scaleOrdinal(d3.schemeCategory10);
    }

    // ── Axes ──────────────────────────────────────────────────────────────────
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6));

    svg.append("g")
        .call(d3.axisLeft(y).ticks(6));

    svg.append("text")
        .attr("x", width / 2).attr("y", height + margin.bottom - 8)
        .attr("text-anchor", "middle")
        .style("font-size", "12px").style("fill", "var(--text-muted)")
        .text(xCol);

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2).attr("y", -margin.left + 16)
        .attr("text-anchor", "middle")
        .style("font-size", "12px").style("fill", "var(--text-muted)")
        .text(yCol);

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const tooltip = container.append("div")
        .style("opacity",        0)
        .style("position",       "absolute")
        .style("background",     "rgba(15,23,42,0.92)")
        .style("color",          "white")
        .style("padding",        "8px 12px")
        .style("border-radius",  "6px")
        .style("font-size",      "12px")
        .style("pointer-events", "none")
        .style("box-shadow",     "0 4px 12px rgba(0,0,0,0.3)")
        .style("z-index",        100);

    // ── Points ────────────────────────────────────────────────────────────────
    const points = svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class",         "dot")
        .attr("cx",            d => x(d[xCol]))
        .attr("cy",            d => y(d[yCol]))
        .attr("r",             d => zCol ? zRadius(d) : zRadius())
        .style("fill",         d => colorCol ? colorScale(d[colorCol]) : colorScale())
        .style("opacity",      0.65)
        .style("stroke",       "rgba(255,255,255,0.6)")
        .style("stroke-width", 0.5)
        .style("cursor",       "pointer")
        .on("mouseover", (event, d) => {
            let html = `<b>${xCol}:</b> ${fmtVal(d[xCol])}<br><b>${yCol}:</b> ${fmtVal(d[yCol])}`;
            if (zCol)     html += `<br><b>${zCol}:</b> ${fmtVal(d[zCol])}`;
            if (colorCol) html += `<br><b>${colorCol}:</b> ${fmtVal(d[colorCol])}`;
            html += `<br><span style="font-size:10px;opacity:0.7">Click to profile this alloy</span>`;

            tooltip.transition().duration(150).style("opacity", 1);
            tooltip.html(html);
            d3.select(event.currentTarget)
                .raise()
                .style("stroke",       "#fff")
                .style("stroke-width", 2)
                .style("opacity",      1);
        })
        .on("mousemove", (event) => {
            const [mx, my] = d3.pointer(event, container.node());
            const containerWidth = container.node().clientWidth;
            
            // If near the right edge, flip tooltip to the left side of the cursor
            // The candidate tooltip can be wider, so we use a larger threshold
            const leftPos = (mx > containerWidth - 200) ? (mx - 200) : (mx + 15);
            
            tooltip.style("left", leftPos + "px").style("top", (my - 20) + "px");
        })
        .on("mouseout", (event, d) => {
            tooltip.transition().duration(400).style("opacity", 0);
            const isSelected = appState.state.selectedPoint === d;
            d3.select(event.currentTarget)
                .style("stroke",       isSelected ? "#f59e0b" : "rgba(255,255,255,0.6)")
                .style("stroke-width", isSelected ? 2.5 : 0.5)
                .style("opacity",      _pointOpacity(d));
        })
        .on("click", (event, d) => {
            appState.setSelectedPoint(d);
        });

    // ── Helper: opacity based on current brush ranges ─────────────────────────
    function _pointOpacity(d) {
        const ranges = appState.state.brushedRanges;
        if (!ranges || Object.keys(ranges).length === 0) return 0.65;
        const passes = Object.entries(ranges).every(([dim, [minV, maxV]]) => {
            const v = d[dim];
            return v !== undefined && v >= minV && v <= maxV;
        });
        return passes ? 0.8 : 0.08;
    }

    // ── Restore any existing selection state visually ─────────────────────────
    const currentPoint  = appState.state.selectedPoint;
    const currentRanges = appState.state.brushedRanges;

    if (currentPoint) {
        // Try to find the nearest matching point by x/y value
        points
            .style("stroke", d =>
                (Math.abs(d[xCol] - currentPoint[xCol]) < 1e-9 &&
                 Math.abs(d[yCol] - currentPoint[yCol]) < 1e-9)
                ? "#f59e0b" : "rgba(255,255,255,0.6)")
            .style("stroke-width", d =>
                (Math.abs(d[xCol] - currentPoint[xCol]) < 1e-9 &&
                 Math.abs(d[yCol] - currentPoint[yCol]) < 1e-9) ? 2.5 : 0.5);
    }

    if (currentRanges && Object.keys(currentRanges).length > 0) {
        points.style("opacity", d => _pointOpacity(d));
    }

    // ── Register named listeners ───────────────────────────────────────────────
    _ce_brushListener = ({ ranges }) => {
        if (!ranges || Object.keys(ranges).length === 0) {
            points
                .style("opacity",      0.65)
                .style("stroke",       "rgba(255,255,255,0.6)")
                .style("stroke-width", 0.5);
        } else {
            points.style("opacity", d => _pointOpacity(d));
        }
    };
    appState.on("brushChange", _ce_brushListener);

    _ce_pointListener = (selectedPoint) => {
        points
            .style("stroke", d => d === selectedPoint ? "#f59e0b" : "rgba(255,255,255,0.6)")
            .style("stroke-width", d => d === selectedPoint ? 2.5 : 0.5)
            .filter(d => d === selectedPoint)
            .raise();
    };
    appState.on("pointSelected", _ce_pointListener);
}

function fmtVal(v) {
    return typeof v === "number" ? v.toFixed(3) : (v ?? "—");
}
