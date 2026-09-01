/**
 * domUtils.js
 * Contains reusable functions for DOM manipulation and D3 setup, 
 * following the DRY principle.
 */

const domUtils = {
    /**
     * Creates an SVG container with standard margins and responsive sizing.
     * @param {string} containerSelector - The CSS selector for the parent container
     * @param {object} margins - Object with top, right, bottom, left margins
     * @returns {object} Object containing the svg selection, inner group (g), inner width and height
     */
    createSvg: function(containerSelector, margins = { top: 20, right: 20, bottom: 40, left: 50 }) {
        const container = d3.select(containerSelector);
        
        // Clear previous contents
        container.selectAll("*").remove();

        const containerNode = container.node();
        if (!containerNode) {
            console.error(`Container ${containerSelector} not found.`);
            return null;
        }

        const width = containerNode.getBoundingClientRect().width;
        const height = containerNode.getBoundingClientRect().height;

        const innerWidth = width - margins.left - margins.right;
        const innerHeight = height - margins.top - margins.bottom;

        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const g = svg.append("g")
            .attr("transform", `translate(${margins.left},${margins.top})`);

        return { svg, g, innerWidth, innerHeight, width, height, margins };
    },

    /**
     * Creates and returns a global tooltip div.
     * @returns {object} D3 selection of the tooltip
     */
    createTooltip: function() {
        let tooltip = d3.select("body").select(".d3-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "d3-tooltip")
                .style("opacity", 0);
        }
        return tooltip;
    },

    /**
     * Helper to show tooltip with HTML content at specific coordinates
     */
    showTooltip: function(tooltip, event, htmlContent) {
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(htmlContent)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px");
    },

    /**
     * Helper to hide tooltip
     */
    hideTooltip: function(tooltip) {
        tooltip.transition().duration(500).style("opacity", 0);
    },

    /**
     * Populates a select dropdown with options
     * @param {string} selector - CSS selector of the select element
     * @param {Array} options - Array of strings for options
     * @param {string} selectedOption - Option to select by default
     * @param {function} onChangeCallback - Function to call on change
     */
    populateDropdown: function(selector, options, selectedOption, onChangeCallback) {
        const select = d3.select(selector);
        
        // Only append if it's empty to prevent duplication, or clear it
        select.selectAll("option").remove();
        
        select.selectAll("option")
            .data(options)
            .enter()
            .append("option")
            .attr("value", d => d)
            .text(d => d)
            .property("selected", d => d === selectedOption);
            
        select.on("change", function(event) {
            onChangeCallback(this.value);
        });
    }
};
