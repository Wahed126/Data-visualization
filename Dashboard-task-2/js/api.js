/**
 * api.js
 * One function per chart — each fetches only the columns that chart needs.
 * This prevents sending large payloads that crash Flask or the browser.
 */

const API_BASE_URL = 'http://localhost:8000/api';

/** Generic fetch wrapper — throws a clean Error on HTTP failures */
async function apiFetch(path) {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status} on ${path}`);
    }
    return res.json();
}

const api = {
    /**
     * Health check — returns row/column counts and the column catalogue.
     * { rows, columns, inputs, elements, phases, mechanical, thermo, numerical }
     */
    checkStatus: () => apiFetch('/status'),

    /**
     * Column catalogue for dropdown population.
     * { numerical: [...], categorical: [...] }
     */
    getColumns: () => apiFetch('/columns'),

    /**
     * Chart 1 — Parallel Coordinates
     * Returns a pipeline-representative sample (default 2000 rows, ~20 columns).
     * @param {number} n - row limit
     */
    getParallelData: (n = 2000) => apiFetch(`/chart/parallel?n=${n}`),

    /**
     * Chart 2 — Bar Chart
     * Element composition averaged per dominant input alloy (tiny payload).
     */
    getBarData: () => apiFetch('/chart/bar'),

    /**
     * Chart 3 — Radar Chart
     * Mechanical + thermo properties averaged per dominant input alloy.
     */
    getRadarData: () => apiFetch('/chart/radar'),

    /**
     * Chart 4 — Scatter Plot
     * Only two columns × n rows. Call again when user changes axis dropdowns.
     * @param {string} x - column name for X axis
     * @param {string} y - column name for Y axis
     * @param {number} n - row limit (default 5000)
     */
    getScatterData: (x, y, n = 5000) =>
        apiFetch(`/chart/scatter?x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&n=${n}`),

    /**
     * Chart 5 — Bubble Chart
     * Only three columns × n rows. Call again when user changes axis dropdowns.
     * @param {string} x - column for X axis
     * @param {string} y - column for Y axis
     * @param {string} z - column for bubble size
     * @param {number} n - row limit (default 5000)
     */
    getBubbleData: (x, y, z, n = 5000) =>
        apiFetch(`/chart/bubble?x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&z=${encodeURIComponent(z)}&n=${n}`),
};
