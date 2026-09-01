/**
 * scatterPlot.js
 * Pure draw function — data pre-fetched by main.js via api.getScatterData().
 * main.js builds the axis dropdowns and calls drawScatterPlot() on each change.
 */

function initScatterPlot(data, containerSelector, controlsSelector) {
    if (!data || data.length === 0) return;

    // Get numerical columns for dropdowns
    const numericalCols = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    if (numericalCols.length < 2) return;

    // Default selections
    let xVar = numericalCols[0];
    let yVar = numericalCols[1];

    // Setup Controls
    const controls = d3.select(controlsSelector);
    controls.selectAll("*").remove();

    controls.append("label").text("X-Axis:").style("font-size", "12px");
    controls.append("select").attr("id", "scatter-x-select");
    
    controls.append("label").text("Y-Axis:").style("font-size", "12px").style("margin-left", "10px");
    controls.append("select").attr("id", "scatter-y-select");

    // Populate dropdowns using domUtils
    domUtils.populateDropdown("#scatter-x-select", numericalCols, xVar, (val) => {
        xVar = val;
        drawScatterPlot(data, containerSelector, xVar, yVar);
    });

    domUtils.populateDropdown("#scatter-y-select", numericalCols, yVar, (val) => {
        yVar = val;
        drawScatterPlot(data, containerSelector, xVar, yVar);
    });

    // Initial draw
    drawScatterPlot(data, containerSelector, xVar, yVar);
}

function drawScatterPlot(data, containerSelector, xVar, yVar) {
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

    // Grid lines (optional for premium look)
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

    // Dots
    g.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d[xVar]))
        .attr("cy", d => y(d[yVar]))
        .attr("r", 3)
        .style("fill", "var(--chart-3)")
        .style("opacity", 0.4)
        .style("stroke", "none")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("r", 6)
                .style("opacity", 1)
                .style("stroke", "var(--text-main)");
                
            domUtils.showTooltip(tooltip, event, `
                <strong>Sample</strong><br>
                ${xVar}: ${d[xVar]}<br>
                ${yVar}: ${d[yVar]}
            `);
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 3)
                .style("opacity", 0.4)
                .style("stroke", "none");
            domUtils.hideTooltip(tooltip);
        });
}
