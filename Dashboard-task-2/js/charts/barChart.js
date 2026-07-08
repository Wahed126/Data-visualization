/**
 * barChart.js
 * Draws a stacked bar chart showing Element Composition.
 * Shows average composition by default, or compares selected alloy vs average.
 */

function drawBarChart(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // We're visualizing Element Columns (Al, Si, Cu, etc)
    const elements = ['Al', 'Si', 'Cu', 'Ni', 'Mg', 'Mn', 'Fe', 'Cr', 'Ti', 'Zr', 'V', 'Zn'];
    const activeElements = elements.filter(e => data[0][e] !== undefined);

    const margin = { top: 30, right: 100, bottom: 40, left: 40 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    svg.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text("Chemical Composition (%)");

    // X scale
    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.2);

    // Y scale
    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, 100]); // percentage

    // Color scale for elements
    const color = d3.scaleOrdinal(d3.schemePaired)
        .domain(activeElements);

    // X axis
    const xAxis = svg.append("g")
        .attr("transform", `translate(0,${height})`);
    
    // Y axis
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5));

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

    const stack = d3.stack().keys(activeElements);
    let seriesGroup = svg.append("g");

    // Function to render/update the bars
    function render(chartData) {
        x.domain(chartData.map(d => d.name));
        xAxis.call(d3.axisBottom(x));

        const series = stack(chartData);

        // Data binding for groups
        const groups = seriesGroup.selectAll("g.series")
            .data(series, d => d.key);

        groups.enter()
            .append("g")
            .attr("class", "series")
            .attr("fill", d => color(d.key))
            .merge(groups)
            .selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x", d => x(d.data.name))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .on("mouseover", function(event, d) {
                const element = d3.select(this.parentNode).datum().key;
                const val = d.data[element];
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`${element}: ${val.toFixed(2)}%`);
                d3.select(this).attr("opacity", 0.7);
            })
            .on("mousemove", function(event) {
                const [mouseX, mouseY] = d3.pointer(event, container.node());
                tooltip.style("left", (mouseX + 15) + "px")
                       .style("top", (mouseY - 20) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition().duration(500).style("opacity", 0);
                d3.select(this).attr("opacity", 1);
            });

        groups.exit().remove();
    }

    // Prepare initial data (grouped averages from backend)
    const initialData = data.map(d => {
        d.name = d._dominant_input || "Avg";
        return d;
    });

    render(initialData);

    // Listen to selection events
    appState.on("pointSelected", (point) => {
        if (!point) {
            render(initialData);
        } else {
            // Compare Selected vs Global Average
            // compute global average from initialData
            const globalAvg = { name: "Global Avg" };
            activeElements.forEach(e => {
                globalAvg[e] = d3.mean(initialData, d => d[e]);
            });
            
            const selectedData = { name: "Selected Alloy" };
            activeElements.forEach(e => {
                selectedData[e] = point[e] || 0;
            });

            render([selectedData, globalAvg]);
        }
    });

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 10}, 0)`);
    
    activeElements.forEach((el, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 15})`);
        row.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(el));
        row.append("text").attr("x", 15).attr("y", 9).text(el).style("font-size", "10px");
    });
}
