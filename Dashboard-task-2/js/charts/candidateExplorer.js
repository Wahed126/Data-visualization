/**
 * candidateExplorer.js
 * Merges Scatter Plot and Bubble Chart into one interactive view.
 * - Listens to AppState for brushing events from Parallel Coordinates
 * - Points clicked here update the AppState selected point (for Radar/Bar charts)
 * - Supports drawing a target region (brush) on this chart too!
 */

function drawCandidateExplorer(data, containerSelector, xCol, yCol, zCol = null, colorCol = null) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Dimensions
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xDomain = d3.extent(data, d => d[xCol]);
    const yDomain = d3.extent(data, d => d[yCol]);
    
    // Add 5% padding to domains
    const xPad = (xDomain[1] - xDomain[0]) * 0.05;
    const yPad = (yDomain[1] - yDomain[0]) * 0.05;

    const x = d3.scaleLinear()
        .domain([xDomain[0] - xPad, xDomain[1] + xPad])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([yDomain[0] - yPad, yDomain[1] + yPad])
        .range([height, 0]);

    // Z Scale (Bubble Size)
    let z = () => 4; // default radius if no zCol
    if (zCol) {
        const zDomain = d3.extent(data, d => d[zCol]);
        z = d3.scaleSqrt()
            .domain(zDomain)
            .range([2, 15]); // min/max bubble radius
    }

    // Color Scale
    let colorScale = () => "var(--chart-1)";
    if (colorCol) {
        // If categorical, use ordinal scale. If numerical, use sequential.
        const isNumerical = typeof data[0][colorCol] === "number";
        if (isNumerical) {
            colorScale = d3.scaleSequential(d3.interpolateViridis)
                .domain(d3.extent(data, d => d[colorCol]));
        } else {
            colorScale = d3.scaleOrdinal(d3.schemeCategory10);
        }
    }

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Axis Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(xCol);

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(yCol);

    // Tooltip
    const tooltip = container.append("div")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", 100);

    // Draw Points
    const points = svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d[xCol]))
        .attr("cy", d => y(d[yCol]))
        .attr("r", d => zCol ? z(d[zCol]) : z())
        .style("fill", d => colorCol ? colorScale(d[colorCol]) : colorScale())
        .style("opacity", 0.6)
        .style("stroke", "white")
        .style("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", 0.9);
            let html = `<b>${xCol}:</b> ${d[xCol].toFixed(2)}<br><b>${yCol}:</b> ${d[yCol].toFixed(2)}`;
            if (zCol) html += `<br><b>${zCol}:</b> ${d[zCol].toFixed(2)}`;
            if (colorCol) html += `<br><b>${colorCol}:</b> ${typeof d[colorCol] === 'number' ? d[colorCol].toFixed(2) : d[colorCol]}`;
            
            tooltip.html(html);
            d3.select(event.currentTarget).style("stroke", "black").style("stroke-width", 2).style("opacity", 1);
        })
        .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip.style("left", (mouseX + 15) + "px")
                   .style("top", (mouseY - 20) + "px");
        })
        .on("mouseout", (event, d) => {
            tooltip.transition().duration(500).style("opacity", 0);
            const isBrushed = appState.state.brushedData.length > 0 && !appState.state.brushedData.includes(d);
            const isSelected = appState.state.selectedPoint === d;
            
            d3.select(event.currentTarget)
                .style("stroke", isSelected ? "black" : "white")
                .style("stroke-width", isSelected ? 2 : 0.5)
                .style("opacity", isBrushed ? 0.1 : 0.6);
        })
        .on("click", (event, d) => {
            appState.setSelectedPoint(d);
        });

    // Handle AppState brush updates
    appState.on("brushChange", (brushedData) => {
        if (brushedData.length === 0) {
            // Reset opacity
            points.style("opacity", 0.6);
        } else {
            // Highlight brushed points
            const brushedSet = new Set(brushedData);
            points.style("opacity", d => brushedSet.has(d) ? 0.8 : 0.1);
        }
    });

    // Handle AppState selection updates
    appState.on("pointSelected", (selectedPoint) => {
        points.style("stroke", d => d === selectedPoint ? "black" : "white")
              .style("stroke-width", d => d === selectedPoint ? 2 : 0.5)
              // Bump selected point to front
              .filter(d => d === selectedPoint).raise();
    });
}
