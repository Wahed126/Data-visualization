# Alloy Property Analyzer — Dashboard Task 2

D3.js + Flask dashboard for visualizing a 212MB alloy dataset across 5 chart types.

---

## Setup Guide

### Prerequisites

- Python 3.10+ installed and in your PATH
- The dataset file at `backend/data/data.txt`

### Step 1 — Create a virtual environment *(skip if* `.venv` *already exists)*

```bash
python -m venv C:\Users\wahee\Desktop\DV\.venv
```

### Step 2 — Install dependencies

```bash
C:\Users\wahee\Desktop\DV\.venv\Scripts\pip.exe install -r backend\requirements.txt
```

Installs: `Flask`, `flask-cors`, `pandas`, `numpy`.

### Step 3 — Place your dataset

Put your tab-separated `.txt` file here:

```
backend/data/data.txt
```

> The file is read with **latin1** encoding to handle special characters like `°C`.

### Step 4 — Start Flask backend

```bash
cd C:\Users\wahee\Desktop\DV\Data-visualization\Dashboard-task-2
C:\Users\wahee\Desktop\DV\.venv\Scripts\python.exe backend\app.py
```

Wait until the terminal shows:

```
Loaded XXXXX rows × 70 columns
 * Running on http://0.0.0.0:8000
```

### Step 5 — Start the frontend server *(in a second terminal)*

```bash
cd C:\Users\wahee\Desktop\DV\Data-visualization\Dashboard-task-2
C:\Users\wahee\Desktop\DV\.venv\Scripts\python.exe -m http.server 3000
```

### Step 6 — Open the dashboard

```
http://localhost:3000
```

All 5 charts will load automatically from the Flask API.

---

## Quick Start

**1. Start the backend**

```bash
cd C:\Users\wahee\Desktop\DV\Data-visualization\Dashboard-task-2
C:\Users\wahee\Desktop\DV\.venv\Scripts\python.exe backend\app.py
```

Flask starts on **port 8000**. The dataset (`backend/data/data.txt`) is loaded into memory immediately on startup.

**2. Start the frontend**

```bash
C:\Users\wahee\Desktop\DV\.venv\Scripts\python.exe -m http.server 3000
```

Open **http://localhost:3000** in your browser.

---

## Project Structure

```
Dashboard-task-2/
├── index.html              # UI layout
├── styles.css              # Light mode design
├── js/
│   ├── api.js              # All fetch() calls to Flask
│   ├── main.js             # App init, renders charts, builds dropdowns
│   └── charts/
│       ├── parallelCoords.js
│       ├── barChart.js
│       ├── radarChart.js
│       ├── scatterPlot.js
│       └── bubbleChart.js
└── backend/
    ├── app.py              # Flask entry point (port 8000, CORS enabled)
    ├── api.py              # Route definitions — one endpoint per chart
    ├── helpers.py          # DataHelper class — all Pandas logic
    ├── requirements.txt
    └── data/
        └── data.txt        # 212MB dataset (tab-separated, latin1)
```

---

## How API & Helpers Are Connected

```
helpers.py          api.py              js/api.js           main.js / chart
──────────          ──────              ─────────           ───────────────
DataHelper          Flask routes        apiFetch()          renderParallelCoords()
.load_data()    ←── app startup                             renderBarChart()
                                                            renderRadarChart()
.get_parallel_data()  ← GET /chart/parallel  ← api.getParallelData()
.get_composition()    ← GET /chart/bar       ← api.getBarData()
.get_properties()     ← GET /chart/radar     ← api.getRadarData()
.get_two_col_sample() ← GET /chart/scatter   ← api.getScatterData(x,y)  ← on dropdown change
.get_three_col_sample()← GET /chart/bubble  ← api.getBubbleData(x,y,z) ← on dropdown change
```

Each route in `api.py` calls **one specific method** in `DataHelper` (helpers.py).\
Each function in `api.js` calls **one specific route** and returns parsed JSON.\
`main.js` calls `api.*` functions and passes the result directly to `draw*()` chart functions.

---

## API Endpoints

| Endpoint | Returns | Used By |
| --- | --- | --- |
| `GET /api/status` | Row/column counts + column catalogue | Health check on load |
| `GET /api/chart/parallel?n=2000` | 2000 rows × 18 pipeline cols | Parallel Coordinates |
| `GET /api/chart/bar` | 6 rows × 12 element means | Bar Chart |
| `GET /api/chart/radar` | 6 rows × 14 property means | Radar Chart |
| `GET /api/chart/scatter?x=A&y=B&n=5000` | 5000 rows × 2 cols | Scatter Plot |
| `GET /api/chart/bubble?x=A&y=B&z=C&n=5000` | 5000 rows × 3 cols | Bubble Chart |
