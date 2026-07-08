/**
 * radarChart.js
 * Draws a radar (spider) chart to profile multivariate data.
 */

function drawRadarChart(data, containerSelector) {
    if (!data || data.length === 0) return;

    const margins = { top: 40, right: 40, bottom: 40, left: 40 };
    const svgObj = domUtils.createSvg(containerSelector, margins);
    if (!svgObj) return;

    const { svg, g, innerWidth, innerHeight } = svgObj;
    
    // Choose dimensions to plot. Grab the last 6 numerical columns for properties
    let numericalCols = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    const features = numericalCols.slice(-Math.min(6, numericalCols.length));
    
    if (features.length < 3) return; // Need at least 3 for a radar chart

    // Calculate normalized averages (0 to 1 scale for each feature based on max value in dataset)
    const profile = features.map(feature => {
        const maxVal = d3.max(data, d => d[feature]) || 1; // avoid div by 0
        const avgVal = d3.mean(data, d => d[feature]);
        return {
            axis: feature,
            value: avgVal / maxVal,
            rawValue: avgVal
        };
    });

    const radius = Math.min(innerWidth, innerHeight) / 2;
    const angleSlice = (Math.PI * 2) / features.length;
    
    // Move origin to center
    g.attr("transform", `translate(${innerWidth/2 + margins.left},${innerHeight/2 + margins.top})`);

    // Draw circular grid lines
    const levels = 5;
    const gridRadius = radius / levels;
    for (let i = 1; i <= levels; i++) {
        g.append("circle")
            .attr("r", gridRadius * i)
            .style("fill", "none")
            .style("stroke", "var(--border)")
            .style("stroke-dasharray", "4,4");
    }

    // Draw Axes (Lines radiating from center)
    const axes = g.selectAll(".axis")
        .data(features)
        .enter()
        .append("g")
        .attr("class", "axis");

    axes.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d, i) => radius * Math.cos(angleSlice * i - Math.PI/2))
        .attr("y2", (d, i) => radius * Math.sin(angleSlice * i - Math.PI/2))
        .style("stroke", "var(--border)")
        .style("stroke-width", "2px");

    // Axis labels
    axes.append("text")
        .attr("class", "legend")
        .style("font-size", "10px")
        .style("fill", "var(--text-main)")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", (d, i) => radius * 1.15 * Math.cos(angleSlice * i - Math.PI/2))
        .attr("y", (d, i) => radius * 1.15 * Math.sin(angleSlice * i - Math.PI/2))
        .text(d => d.length > 12 ? d.substring(0, 10) + "..." : d);

    // Draw Radar Polygon
    const radarLine = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => d.value * radius)
        .curve(d3.curveLinearClosed);

    g.append("path")
        .attr("class", "radar-area")
        .datum(profile)
        .attr("d", radarLine)
        .style("fill", "var(--chart-2)")
        .style("fill-opacity", 0.3)
        .style("stroke", "var(--chart-2)")
        .style("stroke-width", 2);

    // Data Points
    const tooltip = domUtils.createTooltip();
    
    g.selectAll(".radar-circle")
        .data(profile)
        .enter()
        .append("circle")
        .attr("class", "radar-circle")
        .attr("r", 4)
        .attr("cx", (d, i) => d.value * radius * Math.cos(angleSlice * i - Math.PI/2))
        .attr("cy", (d, i) => d.value * radius * Math.sin(angleSlice * i - Math.PI/2))
        .style("fill", "var(--chart-2)")
        .style("stroke", "#fff")
        .style("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7);
            domUtils.showTooltip(tooltip, event, `<strong>${d.axis}</strong><br>Avg: ${d.rawValue.toFixed(3)}`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 4);
            domUtils.hideTooltip(tooltip);
        });
}
