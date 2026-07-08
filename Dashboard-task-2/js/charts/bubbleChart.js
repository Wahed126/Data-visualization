/**
 * bubbleChart.js
 * Pure draw function — data pre-fetched by main.js via api.getBubbleData().
 * main.js builds the axis dropdowns and calls drawBubbleChart() on each change.
 */

function initBubbleChart(data, containerSelector, controlsSelector) {
    if (!data || data.length === 0) return;

    const numericalCols = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    if (numericalCols.length < 3) return;

    // Default selections
    let xVar = numericalCols[0];
    let yVar = numericalCols[1];
    let zVar = numericalCols[2];

    // Setup Controls
    const controls = d3.select(controlsSelector);
    controls.selectAll("*").remove();

    controls.append("label").text("X:").style("font-size", "12px");
    controls.append("select").attr("id", "bubble-x-select");
    
    controls.append("label").text("Y:").style("font-size", "12px").style("margin-left", "10px");
    controls.append("select").attr("id", "bubble-y-select");

    controls.append("label").text("Size:").style("font-size", "12px").style("margin-left", "10px");
    controls.append("select").attr("id", "bubble-z-select");

    // Populate dropdowns
    domUtils.populateDropdown("#bubble-x-select", numericalCols, xVar, (val) => {
        xVar = val;
        drawBubbleChart(data, containerSelector, xVar, yVar, zVar);
    });

    domUtils.populateDropdown("#bubble-y-select", numericalCols, yVar, (val) => {
        yVar = val;
        drawBubbleChart(data, containerSelector, xVar, yVar, zVar);
    });

    domUtils.populateDropdown("#bubble-z-select", numericalCols, zVar, (val) => {
        zVar = val;
        drawBubbleChart(data, containerSelector, xVar, yVar, zVar);
    });

    // Initial draw
    drawBubbleChart(data, containerSelector, xVar, yVar, zVar);
}

function drawBubbleChart(data, containerSelector, xVar, yVar, zVar) {
    const margins = { top: 20, right: 20, bottom: 50, left: 60 };
    const svgObj = domUtils.createSvg(containerSelector, margins);
    if (!svgObj) return;

    const { svg, g, innerWidth, innerHeight } = svgObj;
    const tooltip = domUtils.createTooltip();

    // Scales
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d[xVar]))
        .nice()
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d[yVar]))
        .nice()
        .range([innerHeight, 0]);

    const z = d3.scaleSqrt()
        .domain(d3.extent(data, d => d[zVar]))
        .range([3, 20]); // bubble radius range

    // Axes
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", 40)
        .attr("fill", "var(--text-main)")
        .style("text-anchor", "middle")
        .text(xVar);

    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -innerHeight / 2)
        .attr("fill", "var(--text-main)")
        .style("text-anchor", "middle")
        .text(yVar);

    // Grid
    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(""))
        .style("stroke", "var(--chart-grid)")
        .style("stroke-opacity", 0.7);

    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
        .style("stroke", "var(--chart-grid)")
        .style("stroke-opacity", 0.7);

    // Bubbles
    g.selectAll(".bubble")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => x(d[xVar]))
        .attr("cy", d => y(d[yVar]))
        .attr("r", d => z(d[zVar]))
        .style("fill", "var(--chart-4)")
        .style("opacity", 0.6)
        .style("stroke", "#fff")
        .style("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("opacity", 1)
                .style("stroke", "var(--text-main)");
                
            domUtils.showTooltip(tooltip, event, `
                <strong>Sample Data</strong><br>
                ${xVar}: ${d[xVar]}<br>
                ${yVar}: ${d[yVar]}<br>
                ${zVar}: ${d[zVar]}
            `);
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("opacity", 0.6)
                .style("stroke", "#fff");
            domUtils.hideTooltip(tooltip);
        });
}
