/**
 * barChart.js
 * Pure drawing function — no internal event listeners.
 *
 * drawBarChart(data, containerSelector, selectedPoint?)
 *   data          : array of group-average objects from /chart/bar (element composition by alloy group)
 *   selectedPoint : (optional) full alloy row — shown alongside global average
 *
 * All cross-chart coordination lives in main.js.
 */

function drawBarChart(data, containerSelector, selectedPoint = null) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    const elements       = ['Al', 'Si', 'Cu', 'Ni', 'Mg', 'Mn', 'Fe', 'Cr', 'Ti', 'Zr', 'V', 'Zn'];
    const activeElements = elements.filter(e => data[0][e] !== undefined);

    if (activeElements.length === 0) return;

    const margin = { top: 30, right: 110, bottom: 40, left: 45 };
    const width  = container.node().clientWidth  - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top  - margin.bottom;

    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("text")
        .attr("x", 0).attr("y", -10)
        .style("font-size",   "13px")
        .style("font-weight", "bold")
        .style("fill",        "var(--text-main)")
        .text("Chemical Composition (%)");

    // X scale
    const x = d3.scaleBand().range([0, width]).padding(0.2);

    // Y scale — always 0–100 for elemental wt%
    const y = d3.scaleLinear().range([height, 0]).domain([0, 100]);

    const color = d3.scaleOrdinal(d3.schemePaired).domain(activeElements);

    const xAxis = svg.append("g").attr("transform", `translate(0,${height})`);
    svg.append("g").call(d3.axisLeft(y).ticks(5));

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

    const stack       = d3.stack().keys(activeElements);
    const seriesGroup = svg.append("g");

    function render(chartData) {
        x.domain(chartData.map(d => d.name));
        xAxis.call(d3.axisBottom(x));

        const series = stack(chartData);

        const groups = seriesGroup.selectAll("g.series")
            .data(series, d => d.key);

        groups.enter()
            .append("g")
            .attr("class", "series")
            .attr("fill",  d => color(d.key))
            .merge(groups)
            .selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x",      d => x(d.data.name))
            .attr("y",      d => y(d[1]))
            .attr("height", d => Math.max(0, y(d[0]) - y(d[1])))
            .attr("width",  x.bandwidth())
            .on("mouseover", function(event, d) {
                const element = d3.select(this.parentNode).datum().key;
                const val = d.data[element];
                tooltip.transition().duration(150).style("opacity", 1);
                tooltip.html(`<b>${element}</b>: ${(val || 0).toFixed(3)} wt%`);
                d3.select(this).style("opacity", 0.7);
            })
            .on("mousemove", (event) => {
                const [mx, my] = d3.pointer(event, container.node());
                tooltip.style("left", (mx + 15) + "px").style("top", (my - 20) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition().duration(400).style("opacity", 0);
                d3.select(this).style("opacity", 1);
            });

        groups.exit().remove();
    }

    // Build display data
    // Use alloy_group (correct backend column) as bar label, fallback "Group N"
    const initialData = data.map((d, i) => {
        const name = d.alloy_group || d._dominant_input || `Group ${i + 1}`;
        // Make short labels — strip % signs from input names
        const shortName = name.replace("[%]", "").replace("bat-box", "bat");
        return { ...d, name: shortName };
    });

    if (selectedPoint) {
        // Compute global average from the group averages
        const globalAvg = { name: "Avg" };
        activeElements.forEach(e => {
            globalAvg[e] = d3.mean(initialData, d => d[e]) || 0;
        });

        const selectedData = { name: "Selected" };
        activeElements.forEach(e => {
            const v = selectedPoint[e];
            selectedData[e] = (v !== null && v !== undefined) ? +v : 0;
        });

        render([selectedData, globalAvg]);
    } else {
        render(initialData);
    }

    // Legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width + 8}, 0)`);

    activeElements.forEach((el, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 15})`);
        row.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(el));
        row.append("text").attr("x", 14).attr("y", 9).text(el)
            .style("font-size", "10px").style("fill", "var(--text-main)");
    });
}
