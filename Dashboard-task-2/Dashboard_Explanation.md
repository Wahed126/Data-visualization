# Alloy Property Analyzer & Discovery Dashboard

This document provides a comprehensive, step-by-step explanation of the codebase structure, the engineering decisions behind the dashboard, and a guide on how to extract scientific insights to solve the **2025 IEEE SciVis Contest** challenges.

---

## 1. The Challenge Context

The [2025 IEEE SciVis Contest](https://sciviscontest2025.github.io/tasks/) is centered around a critical materials science and sustainability problem: **How can we design new, high-performance aluminum alloys using recycled scrap metal?**

The dataset consists of over 100,000 simulated alloys generated via CALPHAD (CALculation of PHAse Diagrams). The data pipeline follows this flow:
1. **Inputs:** Scrap mixture ratios (e.g., `bat-box`, `UBC`).
2. **Elemental Composition:** The resulting chemical recipe (64 elements like `Al`, `Si`, `Cu`).
3. **Phases & Solidification:** How the alloy cools (e.g., solidification interval, hot-cracking sensitivity).
4. **Mechanical Properties:** The final real-world performance (e.g., Yield Strength `YS(MPa)`, Hardness).

**The core requirements of the challenge are:**
*   Navigate an enormous, high-dimensional dataset without performance bottlenecks.
*   Find trade-offs between conflicting properties (e.g., strength vs. ductility).
*   Identify "printable" alloys for Additive Manufacturing (low hot-cracking sensitivity).
*   Understand which scrap inputs drive which final properties.

---

## 2. Codebase Structure & Data Flow

Handling 212MB of data (100,000+ rows × 70 columns) directly in a web browser is impossible; it would instantly crash the tab. Therefore, the architecture is split into a **Python Backend** and a **JavaScript/D3.js Frontend**.

### The Python Backend (Data Engine)
The backend acts as a powerful data aggregation and sampling engine. It uses `Pandas` to load the entire dataset into RAM once, and serves specific slices of data to the frontend via a REST API.
*   **`backend/data/data.txt`**: The massive dataset.
*   **`backend/helpers.py`**: The "brain". It contains the `DataHelper` class which manages data loading, calculates Pearson/Spearman correlations, and creates subsets. For example, `get_two_col_sample()` quickly extracts just the X and Y coordinates needed for a scatter plot, throwing away the remaining 68 unused columns to keep payloads tiny.
*   **`backend/api.py`**: The Flask Router. It defines endpoints like `/api/chart/scatter` and maps them to functions in `helpers.py`.
*   **`backend/app.py`**: The server entry point that runs Flask on port 8000 and handles CORS.

### The JavaScript Frontend (Visualization)
Built without heavy frameworks (like React or Vue) to ensure maximum rendering speed, the frontend relies entirely on raw **D3.js (v7)**.
*   **`index.html` & `styles.css`**: Defines the CSS Grid layout and applies a modern, scientific design aesthetic.
*   **`js/api.js`**: Contains clean `fetch()` wrappers to communicate with the Flask backend.
*   **`js/appState.js`**: The **Event Bus**. This is the secret to the dashboard's synchronized interactivity. When a user brushes a chart, `appState` triggers a `brushChange` event, notifying all other charts to highlight those specific alloys.
*   **`js/charts/*.js`**: Pure drawing functions. Each chart (e.g., `parallelCoords.js`, `radarChart.js`) is decoupled from the rest of the app. They accept data and a container ID, and draw the SVG.
*   **`js/main.js`**: The Orchestrator. It fetches the initial data, wires up the UI dropdowns, draws all the charts, and handles window resizing.

---

## 3. The 5 Views: Why They Were Chosen & How to Get Insights

The dashboard is designed as a **linked, progressive drill-down workflow**. You start with a broad overview of the entire dataset and progressively narrow down to a single physical alloy recipe.

### View 1: Pipeline Overview (Parallel Coordinates)
*   **What it is:** A multi-axis line chart where every line is a single alloy, traversing through scrap inputs, phases, and final properties.
*   **Why use it:** It is the gold standard for high-dimensional data. A scatter plot can only show 2 dimensions; this chart shows 15+ simultaneously.
*   **How to get insight:** 
    1. Look at the `YS(MPa)` axis (Yield Strength). Click and drag vertically to create a "brush" over the top 20% highest values.
    2. Watch the lines trace backwards to the left. You will instantly see exactly which scrap input ratios cluster together to create those high-strength alloys.

### View 2: Correlation Heatmap
*   **What it is:** A matrix of Pearson correlation coefficients between inputs (rows) and outputs (columns). Dark Blue = strong positive correlation; Dark Red = strong negative correlation.
*   **Why use it:** Before diving into individual alloys, scientists need to know *which variables matter*. This gives a bird's-eye view of 70×70 variable pairs at once.
*   **How to get insight:** Look for deep blue or red cells. For example, if `Si` intersecting with `hot_cracking_sensitivity` is deep blue, it means adding Silicon drastically increases cracking risk. Click that cell to automatically plot those two variables in the Candidate Explorer.

### View 3: Candidate Explorer (Scatter/Bubble Chart)
*   **What it is:** A classic 2D scatter plot where every point is an alloy, with an optional 3rd dimension encoded as bubble size.
*   **Why use it:** Materials engineering is about trade-offs (e.g., strength vs. ductility). A scatter plot allows you to find the "Pareto Front" (the outer boundary of optimal points).
*   **How to get insight:** Plot `YS(MPa)` on the Y-axis and `Elongation` on the X-axis. Look at the top-right edge of the point cloud—these are your optimal candidates. Set the Bubble Size to `hot_cracking`. If the bubbles in the top right are small, you have found strong, ductile alloys that are also safe to 3D print!

### View 4: Alloy Profile (Radar & Bar Chart)
*   **What it is:** A deep-dive into a single alloy selected from View 3. The Radar chart shows its multi-dimensional property fingerprint, and the Bar chart shows its chemical recipe.
*   **Why use it:** Once you find a promising point, you need its exact chemical makeup. The Radar chart visually highlights how it compares to the global average (the blue shape vs. the red shape).
*   **How to get insight:** Click any point in the Candidate Explorer. Look at the Radar chart—if the Red shape extends far past the Blue shape on the Yield Strength axis, it's a superior alloy. Look at the Bar chart to see exactly what elemental weights (e.g., 90% Al, 5% Si) you need to melt to recreate it in the lab.

### View 5: Sensitivity Analysis (Horizontal Bar Chart)
*   **What it is:** A ranked bar chart showing the Spearman rank correlation of all inputs against one specific target property.
*   **Why use it:** It answers the question: *"Which lever do I pull to fix a problem?"* Spearman is used because it captures non-linear physical relationships better than Pearson.
*   **How to get insight:** Select `hot_cracking_sensitivity` from the dropdown. The chart ranks the inputs. If `Si` has the longest bar pointing left (negative), it tells the engineer: "To stop this alloy from cracking, the most mathematically effective action is to reduce the Silicon content."

---

## 4. How the Dashboard Solves the Contest Requirements

| Contest Requirement | Dashboard Solution |
| :--- | :--- |
| **Navigate 100,000+ alloys** | Python/Pandas backend subsets data; Parallel coordinates handles massive high-dimensional visualization. |
| **Understand input→output relationships** | Correlation Heatmap + Sensitivity Analysis explicitly model these links. |
| **Find alloys meeting multiple targets** | Multi-axis brushing in Parallel Coordinates allows combining boolean constraints (e.g., Strong AND Ductile). |
| **Trade-off analysis** | Candidate Explorer scatter plot naturally reveals Pareto fronts. |
| **Additive manufacturing suitability** | Users can explicitly filter for `hot_cracking` and `solidification_interval` via dropdowns and brushes. |
| **Deep inspection of candidates** | The Alloy Profile view instantly fetches the full 70-column chemical makeup of any clicked alloy. |
