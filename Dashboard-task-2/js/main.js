/**
 * main.js
 * App entry point for the 5-view Alloy Discovery Dashboard.
 * Coordinates data loading and view initialisation.
 */

let numericalColumns  = [];
let categoricalColumns = [];
let parallelData    = [];
let heatmapData     = null;
let candidateData   = null;
let radarData       = null;
let barData         = null;
let sensitivityData = null;
let isInitialized   = false;

// Named listener refs
let _main_colorListener   = null;
let _main_pointListener   = null;  // owns the pointSelected → Alloy Profile link

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
            appState.setBrushedData([], {}); // Clear brush — pass empty ranges too
        });
        appState.on("brushChange", ({ data }) => {
            resetBtn.disabled = !data || data.length === 0;
            document.getElementById("selection-status").textContent =
                (!data || data.length === 0)
                    ? `All Alloys (${meta.rows.toLocaleString()})`
                    : `Selected: ${data.length.toLocaleString()} alloys`;
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
    // BUG FIX: must dispatch change on Y select too (previously only X was dispatched)
    appState.on("heatmapClicked", (axes) => {
        const xSelect = document.getElementById("explorer-x-select");
        const ySelect = document.getElementById("explorer-y-select");
        if (!xSelect || !ySelect) return;

        // Set both values silently first
        xSelect.value = axes.x;
        ySelect.value = axes.y;

        // Then fire a single change event on X — refreshExplorer reads both selects
        xSelect.dispatchEvent(new Event('change'));
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

    buildControlGroup(controls, "X Axis:", "explorer-x-select", numericalColumns, xDefault);
    buildControlGroup(controls, "Y Axis:", "explorer-y-select", numericalColumns, yDefault);
    buildControlGroup(controls, "Bubble Size:", "explorer-z-select", ["None", ...numericalColumns], "None");

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

    // Listen for global color changes — use named ref + off() so redraw doesn't stack
    if (_main_colorListener) appState.off("colorChange", _main_colorListener);
    _main_colorListener = refreshExplorer;
    appState.on("colorChange", _main_colorListener);

    // Initial render
    await refreshExplorer();
}

async function renderAlloyProfile() {
    if (typeof drawRadarChart !== "function" || typeof drawBarChart !== "function") return;

    radarData = await api.getRadarData();
    barData   = await api.getBarData();

    drawRadarChart(radarData, "#radar-chart-container");
    drawBarChart(barData,   "#bar-chart-container");

    // Remove any previous pointSelected listener before registering a new one
    if (_main_pointListener) appState.off("pointSelected", _main_pointListener);

    _main_pointListener = async (point) => {
        if (!point) {
            // Reset: show averages only
            window._lastFullProfile = null;
            drawRadarChart(radarData, "#radar-chart-container", null);
            drawBarChart(barData,   "#bar-chart-container",   null);
            const titleEl = document.getElementById("profile-title");
            if (titleEl) titleEl.textContent = "Click any point to profile it";
            return;
        }

        // Check if the point already has element + property columns
        // (it will if the page was loaded AFTER the backend fix)
        const hasElements   = ["Al", "Si", "Cu"].some(e => point[e] != null);
        const hasProperties = ["YS(MPa)", "hardness(Vickers)"].some(p => point[p] != null);

        let fullPoint = point;

        if (!hasElements || !hasProperties) {
            // Need to fetch the full profile from the backend
            const xCol = document.getElementById("explorer-x-select")?.value;
            const yCol = document.getElementById("explorer-y-select")?.value;
            if (xCol && point[xCol] != null) {
                try {
                    const statusEl = document.getElementById("app-status");
                    setStatus(statusEl, "Loading alloy profile…");
                    fullPoint = await api.getFullProfile(
                        xCol, point[xCol],
                        yCol && point[yCol] != null ? yCol : undefined,
                        yCol && point[yCol] != null ? point[yCol] : undefined
                    );
                    setStatus(statusEl, "Profile loaded ✓", "success");
                } catch (e) {
                    console.warn("Could not fetch full alloy profile:", e);
                    fullPoint = point; // fall back to partial data
                }
            }
        }

        // Show title with key properties
        const ys  = fullPoint["YS(MPa)"];
        const hv  = fullPoint["hardness(Vickers)"];
        const profileTitle = (ys != null || hv != null)
            ? `YS=${ys != null ? ys.toFixed(1) : "?"}MPa  HV=${hv != null ? hv.toFixed(1) : "?"}`
            : null;

        if (profileTitle) {
            const titleEl = document.getElementById("profile-title");
            if (titleEl) titleEl.textContent = profileTitle;
        }

        // Cache so resize redraws can restore the overlay
        window._lastFullProfile = fullPoint;

        // Enable the reset button and show title
        const resetProfileBtn = document.getElementById("reset-profile-btn");
        if (resetProfileBtn) resetProfileBtn.disabled = false;

        drawRadarChart(radarData, "#radar-chart-container", fullPoint);
        drawBarChart(barData,   "#bar-chart-container",   fullPoint);
    };

    appState.on("pointSelected", _main_pointListener);

    // Reset Profile button — clears selection and returns to global averages
    const resetProfileBtn = document.getElementById("reset-profile-btn");
    if (resetProfileBtn) {
        resetProfileBtn.addEventListener("click", () => {
            appState.setSelectedPoint(null);
            resetProfileBtn.disabled = true;
        });
    }
}

async function renderSensitivity() {
    if (typeof drawSensitivityBar !== "function") return;
    if (numericalColumns.length === 0) return;

    // Filter numerical columns to only outputs (Properties/Phases) for the target dropdown
    // For now, we'll just use all numerical columns and let the user pick
    const targetDefault = numericalColumns.includes("YS(MPa)") ? "YS(MPa)" : numericalColumns[numericalColumns.length - 1];

    const controls = document.getElementById("sensitivity-controls");
    controls.innerHTML = '';
    buildControlGroup(controls, "Target Property:", "sensitivity-target-select", numericalColumns, targetDefault);

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

/**
 * Wraps a label + select together in a small flex group so they stay
 * paired when the .controls-row wraps onto multiple lines.
 */
function buildControlGroup(parent, labelText, selectId, options, selected) {
    const group = document.createElement("div");
    group.style.cssText = "display:flex;align-items:center;gap:4px;flex-shrink:0;";

    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    lbl.setAttribute("for", selectId);
    lbl.style.cssText = "font-size:12px;font-weight:600;white-space:nowrap;";
    group.appendChild(lbl);

    const sel = document.createElement("select");
    sel.id = selectId;
    options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        o.selected = opt === selected;
        sel.appendChild(o);
    });
    group.appendChild(sel);
    parent.appendChild(group);
}

// Responsive resize — radar and bar pass the currently selected point so the overlay survives
function redrawCharts() {
    if (typeof drawParallelCoordinates === "function" && parallelData) {
        drawParallelCoordinates(parallelData, "#parallel-coords-container");
    }
    if (typeof drawHeatmap === "function" && heatmapData) {
        drawHeatmap(heatmapData, "#heatmap-container");
    }
    const currentPoint = appState.state.selectedPoint;
    // Use the full cached profile if available (stored by the pointSelected handler)
    const cachedProfile = window._lastFullProfile || currentPoint;
    if (typeof drawRadarChart === "function" && radarData) {
        drawRadarChart(radarData, "#radar-chart-container", cachedProfile || null);
    }
    if (typeof drawBarChart === "function" && barData) {
        drawBarChart(barData, "#bar-chart-container", cachedProfile || null);
    }
    if (typeof drawCandidateExplorer === "function" && candidateData) {
        const x = document.getElementById("explorer-x-select")?.value;
        const y = document.getElementById("explorer-y-select")?.value;
        let z   = document.getElementById("explorer-z-select")?.value;
        if (z === "None") z = null;
        if (x && y) {
            drawCandidateExplorer(candidateData, "#explorer-container", x, y, z, appState.state.colorBy);
        }
    }
    if (typeof drawSensitivityBar === "function" && sensitivityData) {
        const target = document.getElementById("sensitivity-target-select")?.value;
        if (target) drawSensitivityBar(sensitivityData, "#sensitivity-container", target);
    }
}

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (numericalColumns.length) initApp();
    }, 300);
});
