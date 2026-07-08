/**
 * parallelCoords.js
 * Draws a parallel coordinates plot with axis brushing.
 * Brushing an axis filters the data and emits the selection to AppState.
 */

function drawParallelCoordinates(data, containerSelector) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    if (!data || data.length === 0) return;

    // Use full width
    const margin = { top: 30, right: 50, bottom: 20, left: 50 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = container.node().clientHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Dimensions: use keys from first row, except categorical
    let dimensions = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    
    // Y scales for each dimension
    const y = {};
    for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i];
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => d[dim]))
            .range([height, 0]);
    }

    // X scale
    const x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(dimensions);

    // Color scale - default to last dim if colorBy is null
    let colorDim = appState.state.colorBy || dimensions[dimensions.length - 1];
    if (!dimensions.includes(colorDim)) colorDim = dimensions[dimensions.length - 1]; // fallback

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain(d3.extent(data, d => d[colorDim]));

    // Listen for global color changes
    appState.on("colorChange", (newColorCol) => {
        if (dimensions.includes(newColorCol)) {
            colorScale.domain(d3.extent(data, d => d[newColorCol]));
            paths.style("stroke", d => colorScale(d[newColorCol]));
        }
    });

    // Path generator
    const line = (d) => d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));

    // Draw lines
    const paths = svg.append("g")
        .selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", d => colorScale(d[colorDim]))
        .style("stroke-width", 0.8)
        .style("opacity", 0.3);

    // Store active brushes
    const activeBrushes = new Map();

    // Brush event handler
    function brush() {
        const actives = [];
        svg.selectAll(".brush")
            .filter(function(d) {
                const b = d3.brushSelection(this);
                if (b) actives.push({ dim: d, extent: b });
                return b;
            });

        let selected = [];
        
        if (actives.length === 0) {
            // No brushes active
            paths.style("display", null);
        } else {
            // Filter paths
            paths.style("display", function(d) {
                const isActive = actives.every(active => {
                    const dim = active.dim;
                    const p = y[dim](d[dim]);
                    return active.extent[0] <= p && p <= active.extent[1];
                });
                
                if (isActive) selected.push(d);
                return isActive ? null : "none";
            });
        }

        // Debounce state emission to avoid freezing the browser while dragging
        clearTimeout(window.brushDebounce);
        window.brushDebounce = setTimeout(() => {
            appState.setBrushedData(selected);
        }, 100);
    }

    // Draw axes
    const axes = svg.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`);
        
    axes.each(function(d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5));
        
        // Add brush to each axis
        d3.select(this).append("g")
            .attr("class", "brush")
            .call(d3.brushY()
                .extent([[-8, 0], [8, height]])
                .on("start brush end", brush)
            );
    });

    // Add axis titles
    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d.length > 12 ? d.substring(0, 10) + "..." : d)
        .style("fill", "var(--text-main)")
        .style("font-weight", "600")
        .style("font-size", "10px")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            // Click axis title to color by it
            appState.setColorBy(d);
            // Also update the global dropdown UI
            const select = document.getElementById("color-by-select");
            if (select) select.value = d;
        })
        .append("title")
        .text(d => d);

    // External brush clear
    appState.on("brushChange", (data) => {
        if (data.length === 0) {
            // External reset (e.g. from the reset button)
            svg.selectAll(".brush").call(d3.brush().clear);
            paths.style("display", null);
        }
    });
}
