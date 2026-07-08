/**
 * heatmap.js
 * Renders a Pearson correlation matrix.
 * X-axis: Outputs (Phases + Properties)
 * Y-axis: Drivers (Scrap Inputs + Elements)
 */

function drawHeatmap(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || !data.rows || !data.cols || !data.values) return;

    // Dimensions
    const margin = { top: 80, right: 20, bottom: 20, left: 100 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
        .range([0, width])
        .domain(data.cols)
        .padding(0.05);

    const y = d3.scaleBand()
        .range([height, 0])
        .domain(data.rows)
        .padding(0.05);

    // Color scale: -1 (Red) to 0 (White) to 1 (Blue)
    const color = d3.scaleSequential()
        .interpolator(d3.interpolateRdBu)
        .domain([-1, 1]);

    // Tooltip
    const tooltip = container.append("div")
        .attr("class", "heatmap-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.8)")
        .style("color", "white")
        .style("padding", "5px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none");

    // Flatten data for D3
    const flatData = [];
    data.rows.forEach((row, i) => {
        data.cols.forEach((col, j) => {
            if (data.values[i][j] !== null) {
                flatData.push({ row, col, value: data.values[i][j] });
            }
        });
    });

    // Draw cells
    svg.selectAll()
        .data(flatData, d => `${d.row}:${d.col}`)
        .enter()
        .append("rect")
        .attr("x", d => x(d.col))
        .attr("y", d => y(d.row))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", d => color(d.value))
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`${d.row} → ${d.col}<br>r = ${d.value}`);
            d3.select(event.currentTarget).style("stroke", "black").style("stroke-width", 2);
        })
        .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip.style("left", (mouseX + 15) + "px")
                   .style("top", (mouseY - 20) + "px");
        })
        .on("mouseout", (event, d) => {
            tooltip.transition().duration(500).style("opacity", 0);
            d3.select(event.currentTarget).style("stroke", "none");
        })
        .on("click", (event, d) => {
            // Tell AppState to set these as the axes for the Scatter Plot
            appState.emit("heatmapClicked", { x: d.row, y: d.col });
        });

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,-5)`)
        .call(d3.axisTop(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "start")
        .style("font-size", "9px");

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", "9px");
}
