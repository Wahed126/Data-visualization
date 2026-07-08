/**
 * parallelCoords.js
 * Draws a parallel coordinates plot for high-dimensional data.
 */

function drawParallelCoordinates(data, containerSelector) {
    if (!data || data.length === 0) return;

    // Use domUtils to setup SVG
    const margins = { top: 30, right: 50, bottom: 20, left: 50 };
    const svgObj = domUtils.createSvg(containerSelector, margins);
    if (!svgObj) return;

    const { svg, g, innerWidth, innerHeight } = svgObj;

    // Filter to numerical columns only, limit to max 20 to prevent overcrowding
    let dimensions = Object.keys(data[0]).filter(d => typeof data[0][d] === "number" && !isNaN(data[0][d]));
    
    if (dimensions.length > 20) {
        // Take a sample of columns representing inputs, middle pipeline, and outputs
        const step = Math.ceil(dimensions.length / 20);
        dimensions = dimensions.filter((d, i) => i % step === 0).slice(0, 20);
    }

    // Color scale based on the last dimension (often an output property)
    const colorDim = dimensions[dimensions.length - 1];
    const colorExtent = d3.extent(data, d => d[colorDim]);
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain(colorExtent);

    // Create scales for each dimension
    const y = {};
    for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i];
        y[dim] = d3.scaleLinear()
            .domain(d3.extent(data, d => d[dim]))
            .range([innerHeight, 0]);
    }

    const x = d3.scalePoint()
        .range([0, innerWidth])
        .padding(1)
        .domain(dimensions);

    // Path generator
    const line = (d) => {
        return d3.line()(dimensions.map(p => [x(p), y[p](d[p])]));
    };

    // Draw lines
    g.selectAll("path.datapath")
        .data(data)
        .enter()
        .append("path")
        .attr("class", "datapath")
        .attr("d", line)
        .style("fill", "none")
        .style("stroke", d => colorScale(d[colorDim]))
        .style("stroke-width", 0.8)
        .style("opacity", 0.15)
        .on("mouseover", function() {
            d3.select(this)
                .style("stroke-width", 3)
                .style("opacity", 1)
                .raise(); // bring to front
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("stroke-width", 0.8)
                .style("opacity", 0.15);
        });

    // Draw axes
    const axes = g.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)},0)`);
        
    axes.each(function(d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5));
    });

    // Add axis titles
    axes.append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d.length > 10 ? d.substring(0, 8) + "..." : d)
        .style("fill", "var(--text-main)")
        .style("font-weight", "600")
        .style("font-size", "10px")
        .append("title") // tooltip for full name
        .text(d => d);
}
