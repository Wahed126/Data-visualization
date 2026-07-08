/**
 * barChart.js
 * Draws a bar chart comparing average values of selected features.
 */

function drawBarChart(data, containerSelector) {
    if (!data || data.length === 0) return;

    const margins = { top: 30, right: 20, bottom: 60, left: 60 };
    const svgObj = domUtils.createSvg(containerSelector, margins);
    if (!svgObj) return;

    const { svg, g, innerWidth, innerHeight } = svgObj;
    const tooltip = domUtils.createTooltip();

    // Calculate averages for the first 10 numerical columns
    let numericalCols = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d])).slice(0, 10);
    
    if (numericalCols.length === 0) return;

    const averages = numericalCols.map(col => {
        return {
            feature: col,
            value: d3.mean(data, d => d[col])
        };
    });

    // Scales
    const x = d3.scaleBand()
        .domain(averages.map(d => d.feature))
        .range([0, innerWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(averages, d => d.value) * 1.1])
        .nice()
        .range([innerHeight, 0]);

    // Draw Axes
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "10px");

    g.append("g")
        .call(d3.axisLeft(y));

    // Draw Bars
    g.selectAll(".bar")
        .data(averages)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.feature))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.value))
        .attr("fill", "var(--primary)")
        .attr("rx", 4) // rounded corners
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "var(--primary-hover)");
            domUtils.showTooltip(tooltip, event, `<strong>${d.feature}</strong><br>Avg: ${d.value.toFixed(2)}`);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                   .style("top", (event.pageY - 15) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "var(--primary)");
            domUtils.hideTooltip(tooltip);
        });
}
