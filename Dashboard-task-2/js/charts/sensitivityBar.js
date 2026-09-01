/**
 * sensitivityBar.js
 * Horizontal bar chart showing Spearman correlation of inputs vs a single target.
 */

function drawSensitivityBar(data, containerSelector, targetCol) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Dimensions
    const margin = { top: 30, right: 20, bottom: 40, left: 100 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = Math.max(300, data.length * 20) - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add Title
    svg.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text(`Sensitivity: Drivers of ${targetCol}`);

    // Scales
    const x = d3.scaleLinear()
        .domain([-1, 1])
        .range([0, width]);

    const y = d3.scaleBand()
        .range([0, height])
        .domain(data.map(d => d.col))
        .padding(0.1);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5));

    svg.append("g")
        .call(d3.axisLeft(y));

    // Zero line
    svg.append("line")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "gray")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

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

    // Bars
    svg.selectAll("rect.bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(Math.min(0, d.r)))
        .attr("y", d => y(d.col))
        .attr("width", d => Math.abs(x(d.r) - x(0)))
        .attr("height", y.bandwidth())
        .attr("fill", d => d.r > 0 ? "steelblue" : "indianred")
        .on("mouseover", (event, d) => {
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`${d.col}<br>Spearman r: ${d.r}`);
            d3.select(event.currentTarget).attr("opacity", 0.7);
        })
        .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip.style("left", (mouseX + 15) + "px")
                   .style("top", (mouseY - 20) + "px");
        })
        .on("mouseout", (event, d) => {
            tooltip.transition().duration(500).style("opacity", 0);
            d3.select(event.currentTarget).attr("opacity", 1);
        });
}
