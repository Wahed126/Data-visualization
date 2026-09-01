/**
 * parallelCoords.js
 * Parallel coordinates with axis brushing.
 *
 * Emits: brushChange { data, ranges }
 * Listens: colorChange (re-color lines), brushChange with empty data (external reset)
 *
 * Uses named listener refs + appState.off() so redraw doesn't stack listeners.
 */

// Module-level listener references so we can remove them on redraw
let _pc_colorListener   = null;
let _pc_brushListener   = null;

function drawParallelCoordinates(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Remove old listeners before re-registering
    if (_pc_colorListener)  appState.off("colorChange",  _pc_colorListener);
    if (_pc_brushListener)  appState.off("brushChange",  _pc_brushListener);

    const margin = { top: 30, right: 50, bottom: 20, left: 50 };
    const width  = container.node().clientWidth  - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top  - margin.bottom;

    const svg = container.append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const dimensions = Object.keys(data[0]).filter(
        d => typeof data[0][d] === "number" && !isNaN(data[0][d])
    );

    const y = {};
    for (const dim of dimensions) {
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => d[dim]))
            .range([height, 0]);
    }

    const x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(dimensions);

    let colorDim = appState.state.colorBy || dimensions[dimensions.length - 1];
    if (!dimensions.includes(colorDim)) colorDim = dimensions[dimensions.length - 1];

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain(d3.extent(data, d => d[colorDim]));

    const line = (d) => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));

    const paths = svg.append("g")
        .selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("d", line)
        .style("fill",         "none")
        .style("stroke",       d => colorScale(d[colorDim]))
        .style("stroke-width", 0.8)
        .style("opacity",      0.3);

    // ── Brushes ───────────────────────────────────────────────────────────────
    const brushMap      = new Map(); // dim → brushY instance
    const selectionMap  = new Map(); // dim → g element (d3 selection)
    let   _programmaticReset = false; // guard against infinite loop on reset

    function brush() {
        if (_programmaticReset) return; // swallow events fired by our own .move(null)

        const actives   = [];
        const newRanges = {};

        svg.selectAll(".brush").filter(function(d) {
            const sel = d3.brushSelection(this);
            if (sel) {
                actives.push({ dim: d, extent: sel });
                newRanges[d] = [y[d].invert(sel[1]), y[d].invert(sel[0])];
            }
            return sel;
        });

        let selected = [];

        if (actives.length === 0) {
            paths.style("display", null).style("opacity", 0.3).style("stroke-width", 0.8);
        } else {
            paths.style("display", function(d) {
                const pass = actives.every(a => {
                    const p = y[a.dim](d[a.dim]);
                    return a.extent[0] <= p && p <= a.extent[1];
                });
                if (pass) selected.push(d);
                return pass ? null : "none";
            });
            paths.filter(d => selected.includes(d))
                .style("opacity",      0.75)
                .style("stroke-width", 1.2);
        }

        clearTimeout(window.brushDebounce);
        window.brushDebounce = setTimeout(() => {
            appState.setBrushedData(selected, newRanges);
        }, 120);
    }

    // Draw axes + brushes
    const axes = svg.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`);

    axes.each(function(d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5));

        const brushY = d3.brushY()
            .extent([[-8, 0], [8, height]])
            .on("start brush end", brush);

        const brushG = d3.select(this).append("g")
            .attr("class", "brush")
            .datum(d)
            .call(brushY);

        brushMap.set(d, brushY);
        selectionMap.set(d, brushG);
    });

    // Axis titles
    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d.length > 12 ? d.substring(0, 10) + "…" : d)
        .style("fill",        "var(--text-main)")
        .style("font-weight", "600")
        .style("font-size",   "10px")
        .style("cursor",      "pointer")
        .on("click", (event, d) => {
            appState.setColorBy(d);
            const select = document.getElementById("color-by-select");
            if (select) select.value = d;
        })
        .append("title")
        .text(d => d);

    // ── Register named listeners ───────────────────────────────────────────────

    _pc_colorListener = (newColorCol) => {
        if (dimensions.includes(newColorCol)) {
            colorScale.domain(d3.extent(data, d => d[newColorCol]));
            paths.style("stroke", d => colorScale(d[newColorCol]));
        }
    };
    appState.on("colorChange", _pc_colorListener);

    // React to external brush clear (Reset Selection button)
    _pc_brushListener = ({ data: brushedData }) => {
        if (brushedData && brushedData.length === 0) {
            _programmaticReset = true;
            selectionMap.forEach((gSel, dim) => {
                brushMap.get(dim).move(gSel, null);
            });
            _programmaticReset = false;
            paths.style("display", null).style("opacity", 0.3).style("stroke-width", 0.8);
        }
    };
    appState.on("brushChange", _pc_brushListener);
}
