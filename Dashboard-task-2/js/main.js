/**
 * main.js
 * App entry point.
 * - On load: fetches metadata (column list) then renders each chart independently.
 * - Scatter and Bubble re-fetch from the API whenever the user changes axes.
 */

let numericalColumns = [];   // populated from /api/columns — used by dropdowns

document.addEventListener("DOMContentLoaded", initApp);

// ──────────────────────────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────────────────────────
async function initApp() {
    const statusEl   = document.getElementById("app-status");
    const progressEl = document.getElementById("progress-container");

    try {
        setStatus(statusEl, "Connecting to backend…");

        const meta = await api.checkStatus();
        numericalColumns = meta.numerical || [];
        setStatus(statusEl,
            `Backend ready — ${meta.rows.toLocaleString()} rows × ${meta.columns} cols`);

        // Render each chart independently & in parallel where possible
        await Promise.all([
            renderParallelCoords(),
            renderBarChart(),
            renderRadarChart(),
        ]);

        // Scatter + Bubble need default axis values first — run after columns known
        await renderScatterPlot();
        await renderBubbleChart();

        progressEl.style.display = "none";
        setStatus(statusEl, "All charts loaded ✓", "success");

    } catch (err) {
        setStatus(statusEl,
            `Error: ${err.message} — Is Flask running on port 8000?`, "error");
        progressEl.style.display = "none";
        console.error(err);
    }
}

// ──────────────────────────────────────────────────────────────────
// Per-chart render functions
// ──────────────────────────────────────────────────────────────────

async function renderParallelCoords() {
    if (typeof drawParallelCoordinates !== "function") return;
    const data = await api.getParallelData(2000);
    drawParallelCoordinates(data, "#parallel-coords-container");
}

async function renderBarChart() {
    if (typeof drawBarChart !== "function") return;
    const data = await api.getBarData();
    drawBarChart(data, "#bar-chart-container");
}

async function renderRadarChart() {
    if (typeof drawRadarChart !== "function") return;
    const data = await api.getRadarData();
    drawRadarChart(data, "#radar-chart-container");
}

async function renderScatterPlot() {
    if (typeof initScatterPlot !== "function") return;
    if (numericalColumns.length < 2) return;

    const [xDefault, yDefault] = numericalColumns;

    // Build dropdown controls
    const controls = document.getElementById("scatter-controls");
    controls.innerHTML = '';
    buildLabel(controls, "X:");
    buildDropdown(controls, "scatter-x-select", numericalColumns, xDefault);
    buildLabel(controls, "Y:", "margin-left:10px");
    buildDropdown(controls, "scatter-y-select", numericalColumns, yDefault);

    // Initial fetch + draw
    await refreshScatter(xDefault, yDefault);

    // Re-fetch on axis change
    document.getElementById("scatter-x-select").addEventListener("change", async () => {
        const x = document.getElementById("scatter-x-select").value;
        const y = document.getElementById("scatter-y-select").value;
        await refreshScatter(x, y);
    });
    document.getElementById("scatter-y-select").addEventListener("change", async () => {
        const x = document.getElementById("scatter-x-select").value;
        const y = document.getElementById("scatter-y-select").value;
        await refreshScatter(x, y);
    });
}

async function refreshScatter(x, y) {
    const data = await api.getScatterData(x, y, 5000);
    drawScatterPlot(data, "#scatter-plot-container", x, y);
}

async function renderBubbleChart() {
    if (typeof drawBubbleChart !== "function") return;
    if (numericalColumns.length < 3) return;

    const [xDefault, yDefault, zDefault] = numericalColumns;

    const controls = document.getElementById("bubble-controls");
    controls.innerHTML = '';
    buildLabel(controls, "X:");
    buildDropdown(controls, "bubble-x-select", numericalColumns, xDefault);
    buildLabel(controls, "Y:", "margin-left:10px");
    buildDropdown(controls, "bubble-y-select", numericalColumns, yDefault);
    buildLabel(controls, "Size:", "margin-left:10px");
    buildDropdown(controls, "bubble-z-select", numericalColumns, zDefault);

    await refreshBubble(xDefault, yDefault, zDefault);

    const onChange = async () => {
        const x = document.getElementById("bubble-x-select").value;
        const y = document.getElementById("bubble-y-select").value;
        const z = document.getElementById("bubble-z-select").value;
        await refreshBubble(x, y, z);
    };
    ["bubble-x-select", "bubble-y-select", "bubble-z-select"]
        .forEach(id => document.getElementById(id).addEventListener("change", onChange));
}

async function refreshBubble(x, y, z) {
    const data = await api.getBubbleData(x, y, z, 5000);
    drawBubbleChart(data, "#bubble-chart-container", x, y, z);
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
    lbl.style.cssText = `font-size:12px;${style}`;
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

// ──────────────────────────────────────────────────────────────────
// Responsive resize (debounced)
// ──────────────────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (numericalColumns.length) initApp();
    }, 300);
});
