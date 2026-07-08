/**
 * main.js
 * App entry point for the 5-view Alloy Discovery Dashboard.
 * Coordinates data loading and view initialisation.
 */

let numericalColumns = [];
let categoricalColumns = [];
let parallelData = []; // Store globally for cross-filtering
let heatmapData = null;
let candidateData = null;
let radarData = null;
let barData = null;
let sensitivityData = null;
let isInitialized = false;

document.addEventListener("DOMContentLoaded", initApp);

// ──────────────────────────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────────────────────────
async function initApp() {
    if (isInitialized) {
        redrawCharts();
        return;
    }
    const statusEl = document.getElementById("app-status");
    try {
        setStatus(statusEl, "Connecting to backend…");

        // 1. Get Metadata
        const meta = await api.checkStatus();
        numericalColumns = meta.numerical || [];
        categoricalColumns = meta.categorical || [];
        
        setStatus(statusEl, `Connected — ${meta.rows.toLocaleString()} alloys loaded.`);
        document.getElementById("selection-status").textContent = `All Alloys (${meta.rows.toLocaleString()})`;

        // Populate global color-by dropdown
        const colorSelect = document.getElementById("color-by-select");
        numericalColumns.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            colorSelect.appendChild(opt);
        });
        colorSelect.addEventListener("change", (e) => appState.setColorBy(e.target.value));

        // Setup Reset Brush button
        const resetBtn = document.getElementById("reset-brush-btn");
        resetBtn.addEventListener("click", () => {
            appState.setBrushedData([]); // Clear brush
        });
        appState.on("brushChange", (data) => {
            resetBtn.disabled = data.length === 0;
            document.getElementById("selection-status").textContent = 
                data.length === 0 ? `All Alloys (${meta.rows.toLocaleString()})` : `Selected Alloys (${data.length})`;
        });

        // 2. Fetch Data & Render Views
        // We load parallel data first as it's the "master" dataset for brushing
        parallelData = await api.getParallelData(2000);
        
        await Promise.all([
            renderParallelCoords(),
            renderHeatmap(),
            renderCandidateExplorer(),
            renderAlloyProfile(),
            renderSensitivity()
        ]);

        isInitialized = true;
        setStatus(statusEl, "All views ready ✓", "success");
        
        // Force redraw after a short delay so CSS grid/flex layout can calculate clientWidth correctly
        setTimeout(redrawCharts, 100);

    } catch (err) {
        setStatus(statusEl, `Error: ${err.message} — Is Flask running on port 8000?`, "error");
        console.error(err);
    }
}

// ──────────────────────────────────────────────────────────────────
// View Renderers
// ──────────────────────────────────────────────────────────────────

async function renderParallelCoords() {
    if (typeof drawParallelCoordinates !== "function") return;
    drawParallelCoordinates(parallelData, "#parallel-coords-container");
}

async function renderHeatmap() {
    if (typeof drawHeatmap !== "function") return;
    heatmapData = await api.getHeatmapData();
    drawHeatmap(heatmapData, "#heatmap-container");

    // Listen for clicks on the heatmap to change the Candidate Explorer axes
    appState.on("heatmapClicked", (axes) => {
        const xSelect = document.getElementById("explorer-x-select");
        const ySelect = document.getElementById("explorer-y-select");
        if (xSelect && ySelect) {
            xSelect.value = axes.x;
            ySelect.value = axes.y;
            // Manually trigger change event
            xSelect.dispatchEvent(new Event('change'));
        }
    });
}

async function renderCandidateExplorer() {
    if (typeof drawCandidateExplorer !== "function") return;
    if (numericalColumns.length < 2) return;

    // Use dataset columns for default axes
    const xDefault = numericalColumns[0];
    const yDefault = numericalColumns[1];
    const zDefault = numericalColumns[2] || ""; // Empty means no bubble mode initially

    const controls = document.getElementById("explorer-controls");
    controls.innerHTML = '';
    
    buildLabel(controls, "X Axis:");
    buildDropdown(controls, "explorer-x-select", numericalColumns, xDefault);
    
    buildLabel(controls, "Y Axis:", "margin-left:15px;");
    buildDropdown(controls, "explorer-y-select", numericalColumns, yDefault);
    
    buildLabel(controls, "Bubble Size (Optional):", "margin-left:15px;");
    buildDropdown(controls, "explorer-z-select", ["None", ...numericalColumns], "None");

    const refreshExplorer = async () => {
        const x = document.getElementById("explorer-x-select").value;
        const y = document.getElementById("explorer-y-select").value;
        let z = document.getElementById("explorer-z-select").value;
        if (z === "None") z = null;

        // Fetch just the columns we need
        if (z) {
            candidateData = await api.getBubbleData(x, y, z, 5000);
        } else {
            candidateData = await api.getScatterData(x, y, 5000);
        }
        
        // Draw chart
        drawCandidateExplorer(candidateData, "#explorer-container", x, y, z, appState.state.colorBy);
    };

    // Listen for axis changes
    ["explorer-x-select", "explorer-y-select", "explorer-z-select"].forEach(id => {
        document.getElementById(id).addEventListener("change", refreshExplorer);
    });

    // Listen for global color changes
    appState.on("colorChange", refreshExplorer);

    // Initial render
    await refreshExplorer();
}

async function renderAlloyProfile() {
    if (typeof drawRadarChart !== "function" || typeof drawBarChart !== "function") return;
    
    // We start with the average dataset
    radarData = await api.getRadarData();
    barData = await api.getBarData();
    
    drawRadarChart(radarData, "#radar-chart-container");
    drawBarChart(barData, "#bar-chart-container");

    // Later: update these when appState.state.selectedPoint changes
    // (This requires updating radarChart.js and barChart.js to support comparing a point vs average)
}

async function renderSensitivity() {
    if (typeof drawSensitivityBar !== "function") return;
    if (numericalColumns.length === 0) return;

    // Filter numerical columns to only outputs (Properties/Phases) for the target dropdown
    // For now, we'll just use all numerical columns and let the user pick
    const targetDefault = numericalColumns.includes("YS(MPa)") ? "YS(MPa)" : numericalColumns[numericalColumns.length - 1];

    const controls = document.getElementById("sensitivity-controls");
    controls.innerHTML = '';
    buildLabel(controls, "Target Property:");
    buildDropdown(controls, "sensitivity-target-select", numericalColumns, targetDefault);

    const refreshSensitivity = async () => {
        const target = document.getElementById("sensitivity-target-select").value;
        sensitivityData = await api.getSensitivityData(target);
        drawSensitivityBar(sensitivityData, "#sensitivity-container", target);
    };

    document.getElementById("sensitivity-target-select").addEventListener("change", refreshSensitivity);
    
    // Initial render
    await refreshSensitivity();
}

// ──────────────────────────────────────────────────────────────────
// DOM Helpers
// ──────────────────────────────────────────────────────────────────
function setStatus(el, text, state = "default") {
    if (!el) return;
    el.textContent = text;
    el.style.color = state === "success" ? "var(--chart-2)"
                   : state === "error"   ? "var(--chart-4)"
                   :                       "var(--text-main)";
}

function buildLabel(parent, text, style = "") {
    const lbl = document.createElement("label");
    lbl.textContent = text;
    lbl.style.cssText = `font-size:12px;font-weight:600;margin-right:5px;${style}`;
    parent.appendChild(lbl);
}

function buildDropdown(parent, id, options, selected) {
    const sel = document.createElement("select");
    sel.id = id;
    options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        o.selected = opt === selected;
        sel.appendChild(o);
    });
    parent.appendChild(sel);
}

// Responsive resize
function redrawCharts() {
    if (typeof drawParallelCoordinates === "function" && parallelData) {
        drawParallelCoordinates(parallelData, "#parallel-coords-container");
    }
    if (typeof drawHeatmap === "function" && heatmapData) {
        drawHeatmap(heatmapData, "#heatmap-container");
    }
    if (typeof drawCandidateExplorer === "function" && candidateData) {
        const x = document.getElementById("explorer-x-select").value;
        const y = document.getElementById("explorer-y-select").value;
        let z = document.getElementById("explorer-z-select").value;
        if (z === "None") z = null;
        drawCandidateExplorer(candidateData, "#explorer-container", x, y, z, appState.state.colorBy);
    }
    if (typeof drawRadarChart === "function" && radarData) {
        drawRadarChart(radarData, "#radar-chart-container");
    }
    if (typeof drawBarChart === "function" && barData) {
        drawBarChart(barData, "#bar-chart-container");
    }
    if (typeof drawSensitivityBar === "function" && sensitivityData) {
        const target = document.getElementById("sensitivity-target-select").value;
        drawSensitivityBar(sensitivityData, "#sensitivity-container", target);
    }
}

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (numericalColumns.length) initApp();
    }, 300);
});
