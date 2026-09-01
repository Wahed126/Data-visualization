/**
 * radarChart.js
 * Pure drawing function — no internal event listeners.
 *
 * drawRadarChart(data, containerSelector, selectedPoint?)
 *   data          : array of group-average objects from /chart/radar
 *   selectedPoint : (optional) full alloy row — overlay on top of the global average
 *
 * All cross-chart coordination (pointSelected → fetch profile → redraw) lives in main.js.
 */

function drawRadarChart(data, containerSelector, selectedPoint = null) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Determine features: numerical columns from radar data (MECH + THERMO only)
    const allFeatures = Object.keys(data[0]).filter(
        k => typeof data[0][k] === "number" && !isNaN(data[0][k])
    );
    const features = allFeatures.slice(-Math.min(10, allFeatures.length));

    if (features.length < 3) return;

    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const width  = container.node().clientWidth  - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top  - margin.bottom;

    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${width/2 + margin.left},${height/2 + margin.top})`);

    const radius     = Math.min(width, height) / 2;
    const angleSlice = (Math.PI * 2) / features.length;

    // Max values from the average data — defines the scale
    const maxValues = {};
    features.forEach(f => {
        maxValues[f] = d3.max(data, d => d[f]) || 1;
    });

    // Global average profile (average of all group averages)
    const globalAvgProfile = features.map(f => ({
        axis:     f,
        value:    (d3.mean(data, d => d[f]) || 0) / maxValues[f],
        rawValue:  d3.mean(data, d => d[f]) || 0,
    }));

    // Circular grid lines
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
        svg.append("circle")
            .attr("r", (radius / levels) * i)
            .style("fill",           "none")
            .style("stroke",         "#eee")
            .style("stroke-dasharray","2,2");
    }

    // Axes
    const axes = svg.selectAll(".axis")
        .data(features).enter()
        .append("g").attr("class", "axis");

    axes.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", (d, i) => radius * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("y2", (d, i) => radius * Math.sin(angleSlice * i - Math.PI / 2))
        .style("stroke", "#ddd").style("stroke-width", "1px");

    axes.append("text")
        .attr("class", "legend")
        .style("font-size",   "10px")
        .style("fill",        "var(--text-main)")
        .attr("text-anchor",  "middle")
        .attr("dy",           "0.35em")
        .attr("x", (d, i) => radius * 1.18 * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("y", (d, i) => radius * 1.18 * Math.sin(angleSlice * i - Math.PI / 2))
        .text(d => d.length > 10 ? d.substring(0, 8) + "…" : d)
        .append("title").text(d => d);

    // Tooltip
    const tooltip = container.append("div")
        .style("opacity",        0)
        .style("position",       "absolute")
        .style("background",     "rgba(15,23,42,0.92)")
        .style("color",          "white")
        .style("padding",        "6px 10px")
        .style("border-radius",  "6px")
        .style("font-size",      "12px")
        .style("pointer-events", "none")
        .style("z-index",        "100");

    const radarLine = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => Math.max(0, d.value) * radius)
        .curve(d3.curveLinearClosed);

    function drawPolygon(profileData, color, name) {
        const cls = name.toLowerCase().replace(/\s+/g, "-");

        svg.selectAll(`.radar-area.${cls}`).remove();
        svg.selectAll(`.radar-pt.${cls}`).remove();

        svg.append("path")
            .attr("class",       `radar-area ${cls}`)
            .datum(profileData)
            .attr("d",           radarLine)
            .style("fill",       color)
            .style("fill-opacity", 0.25)
            .style("stroke",     color)
            .style("stroke-width", 2.5);

        svg.selectAll(`.radar-pt.${cls}`)
            .data(profileData)
            .enter()
            .append("circle")
            .attr("class", `radar-pt ${cls}`)
            .attr("r", 4)
            .attr("cx", (d, i) => Math.max(0, d.value) * radius * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("cy", (d, i) => Math.max(0, d.value) * radius * Math.sin(angleSlice * i - Math.PI / 2))
            .style("fill", color).style("stroke", "#fff").style("stroke-width", 1)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 7);
                tooltip.transition().duration(150).style("opacity", 1);
                tooltip.html(`<b>${name}</b><br>${d.axis}: ${(d.rawValue || 0).toFixed(4)}`);
            })
            .on("mousemove", (event) => {
                const [mx, my] = d3.pointer(event, container.node());
                tooltip.style("left", (mx + 15) + "px").style("top", (my - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 4);
                tooltip.transition().duration(400).style("opacity", 0);
            });
    }

    // Always draw global average
    drawPolygon(globalAvgProfile, "var(--primary)", "Global Average");

    // If a selected point is provided, overlay it
    if (selectedPoint) {
        const selectedProfile = features.map(f => {
            const rawVal = (selectedPoint[f] != null) ? selectedPoint[f] : 0;
            return {
                axis:     f,
                value:    maxValues[f] > 0 ? rawVal / maxValues[f] : 0,
                rawValue: rawVal,
            };
        });
        drawPolygon(selectedProfile, "var(--chart-4)", "Selected Alloy");
    }

    // Legend
    const legend = container.append("div")
        .style("display",         "flex")
        .style("justify-content", "center")
        .style("gap",             "18px")
        .style("margin-top",      "6px")
        .style("font-size",       "12px");

    legend.html(`
        <div style="display:flex;align-items:center;gap:5px;">
            <div style="width:12px;height:12px;background:var(--primary);"></div> Global Average
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
            <div style="width:12px;height:12px;background:var(--chart-4);"></div>
            ${selectedPoint ? "Selected Alloy" : "<span style='opacity:0.5'>Click a point to compare</span>"}
        </div>
    `);
}
