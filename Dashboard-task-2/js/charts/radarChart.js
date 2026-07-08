/**
 * radarChart.js
 * Draws a radar chart comparing properties.
 * Shows average properties by default, overlays selected point if one is clicked.
 */

function drawRadarChart(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Use all 14 property features (Mechanical + Thermo)
    // The bar chart handles Elements, the scatter handles whatever they select.
    // Let's filter to features that actually exist in the data.
    const allFeatures = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    // Exclude elements and inputs to focus on outputs for the radar
    const features = allFeatures.slice(-Math.min(10, allFeatures.length)); // limit to 10 for readability

    if (features.length < 3) return; // Need at least 3 for a radar chart

    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${width/2 + margin.left},${height/2 + margin.top})`);

    const radius = Math.min(width, height) / 2;
    const angleSlice = (Math.PI * 2) / features.length;
    
    // Determine max values for normalization
    const maxValues = {};
    features.forEach(f => {
        maxValues[f] = d3.max(data, d => d[f]) || 1;
    });

    // Compute Global Average
    const globalAvgProfile = features.map(f => {
        const avgVal = d3.mean(data, d => d[f]);
        return {
            axis: f,
            value: avgVal / maxValues[f],
            rawValue: avgVal
        };
    });

    // Draw circular grid lines
    const levels = 5;
    const gridRadius = radius / levels;
    for (let i = 1; i <= levels; i++) {
        svg.append("circle")
            .attr("r", gridRadius * i)
            .style("fill", "none")
            .style("stroke", "#eee")
            .style("stroke-dasharray", "2,2");
    }

    // Draw Axes
    const axes = svg.selectAll(".axis")
        .data(features)
        .enter()
        .append("g")
        .attr("class", "axis");

    axes.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d, i) => radius * Math.cos(angleSlice * i - Math.PI/2))
        .attr("y2", (d, i) => radius * Math.sin(angleSlice * i - Math.PI/2))
        .style("stroke", "#ddd")
        .style("stroke-width", "1px");

    // Axis labels
    axes.append("text")
        .attr("class", "legend")
        .style("font-size", "10px")
        .style("fill", "var(--text-main)")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", (d, i) => radius * 1.15 * Math.cos(angleSlice * i - Math.PI/2))
        .attr("y", (d, i) => radius * 1.15 * Math.sin(angleSlice * i - Math.PI/2))
        .text(d => d.length > 10 ? d.substring(0, 8) + "..." : d)
        .append("title")
        .text(d => d);

    // Tooltip
    const tooltip = container.append("div")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.8)")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none");

    const radarLine = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => d.value * radius)
        .curve(d3.curveLinearClosed);

    function drawPolygon(profileData, color, name) {
        const className = name.replace(" ", "-").toLowerCase();
        
        // Remove existing if any
        svg.selectAll(`.radar-area.${className}`).remove();
        svg.selectAll(`.radar-circle.${className}`).remove();

        svg.append("path")
            .attr("class", `radar-area ${className}`)
            .datum(profileData)
            .attr("d", radarLine)
            .style("fill", color)
            .style("fill-opacity", 0.3)
            .style("stroke", color)
            .style("stroke-width", 2);

        svg.selectAll(`.radar-circle.${className}`)
            .data(profileData)
            .enter()
            .append("circle")
            .attr("class", `radar-circle ${className}`)
            .attr("r", 4)
            .attr("cx", (d, i) => d.value * radius * Math.cos(angleSlice * i - Math.PI/2))
            .attr("cy", (d, i) => d.value * radius * Math.sin(angleSlice * i - Math.PI/2))
            .style("fill", color)
            .style("stroke", "#fff")
            .style("stroke-width", 1)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 7);
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`<strong>${name}</strong><br>${d.axis}: ${d.rawValue.toFixed(3)}`);
            })
            .on("mousemove", function(event) {
                const [mouseX, mouseY] = d3.pointer(event, container.node());
                tooltip.style("left", (mouseX + 15) + "px")
                       .style("top", (mouseY - 20) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 4);
                tooltip.transition().duration(500).style("opacity", 0);
            });
    }

    // Draw average initially
    drawPolygon(globalAvgProfile, "var(--primary)", "Global Average");

    // Listen to selection events
    appState.on("pointSelected", (point) => {
        if (!point) {
            svg.selectAll(".radar-area.selected-alloy").remove();
            svg.selectAll(".radar-circle.selected-alloy").remove();
        } else {
            const selectedProfile = features.map(f => {
                const val = point[f] || 0;
                return {
                    axis: f,
                    value: val / maxValues[f],
                    rawValue: val
                };
            });
            drawPolygon(selectedProfile, "var(--chart-4)", "Selected Alloy");
        }
    });

    // Legend
    const legend = container.append("div")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("margin-top", "10px")
        .style("font-size", "12px");
    
    legend.html(`
        <div style="display:flex; align-items:center; margin-right:15px;">
            <div style="width:12px; height:12px; background:var(--primary); margin-right:5px;"></div> Global Average
        </div>
        <div style="display:flex; align-items:center;">
            <div style="width:12px; height:12px; background:var(--chart-4); margin-right:5px;"></div> Selected Alloy
        </div>
    `);
}
