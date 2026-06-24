# Dashboard Implementation Plan
## Exploration of Recycled Aluminium Alloy Design Space

---

## 1. Dataset Summary

| Category | Variables | Count |
|---|---|---|
| Scrap mixture inputs | KS1295, 6082, 2024, Batterybox, 4043, 3003 (all in %) | 6 |
| Chemical composition | Al, Si, Cu, Ni, Mg, Mn, Fe, Cr, Ti, Zr, V, Zn (wt.%) | 12 |
| Phase formation | Volume fractions (Vf_*) + solidification temps (T_*) + intervals (delta_T_*) + eutectic + CSC | 38 |
| Material properties | YS (MPa), Hardness (Vickers), thermal conductivity, density, el. conductivity, etc. | 14 |
| **Total** | | **70 columns, >100,000 rows** |

Key data characteristics:
- All variables are **continuous/numerical** — no native categorical labels.
- Many **NaN values** in phase columns (phase does not form for that composition).
- Dataset is ~223 MB — rendering all 100K rows directly in SVG is not feasible.
- The SciVis contest itself uses a **parallel coordinates plot** as the primary visualization (see Fig.1 on contest page).

---

## 2. Chart Appropriateness Evaluation

### 2.1 Scatter Plot ✅ Appropriate

**Verdict: Appropriate.**

- Good fit for exploring pairwise relationships between numerical variables (e.g., Si content vs. Yield Strength, Mg vs. Thermal Conductivity).
- Already implemented in Part 1 of the framework — can be reused with coordination.
- **Concern**: With 100K+ points, overplotting is severe. Mitigation: use opacity (alpha blending), a data sample (e.g., 3,000–5,000 rows), or hexbin aggregation.
- In the dashboard, this serves as the "detail" view after brushing in the parallel coordinates.

### 2.2 Bubble Chart ✅ Appropriate (with caveats)

**Verdict: Appropriate, but only for filtered/sampled data.**

- Extends scatter plots by encoding a third dimension via bubble size (e.g., x=Cu, y=YS, size=Hardness).
- Useful for the goal "which compositions lead to favorable properties."
- **Concern**: 100K bubbles will completely obscure each other. Must be restricted to the currently brushed/selected subset (ideally < 500 points) or a pre-sampled view.
- Best combined with the parallel coordinates brush interaction: what you brush there, you see in the bubble chart.
- Given the dashboard has only **4 slots**, the bubble chart can be merged with the scatter plot (the existing "size" channel in Part 1 already does this). No need for a dedicated separate slot.

### 2.3 Parallel Coordinates Plot ✅ Highly Appropriate — Priority 1

**Verdict: Highly appropriate and the most important chart for this dataset.**

- This is the primary tool for exploring relationships across many dimensions simultaneously — exactly what this 70-column dataset requires.
- The SciVis contest organizers themselves use a parallel coordinates plot as their primary example (Fig.1 on the contest background page).
- Enables linking scrap inputs → chemical composition → phase formation → material properties in a single view.
- Interactive **axis brushing** naturally implements filtering/selection that drives the other charts.
- **Concern**: 100K lines will be visually unreadable. Mitigation: render a random sample (~3,000–5,000 rows) with low opacity, and allow brush-to-filter.
- Should be assigned to **Chart 1** (largest chart, primary overview).

### 2.4 Bar Charts ⚠️ Partially Appropriate

**Verdict: Appropriate only when repurposed as histograms — not appropriate as comparison bars over continuous data.**

- The entire dataset is continuous/numerical. Traditional categorical bar charts (one bar per alloy) would produce 100,000 bars, which is meaningless.
- However, **histograms** (bin-based bar charts) are a valid and useful chart type for this data:
  - Show the distribution of a selected material property (e.g., distribution of Yield Strength across all alloys).
  - Show how many alloys form a given phase (count of rows where Vf_* > 0).
  - Show phase fraction distributions.
- **Recommendation**: Implement as a **histogram / distribution bar chart** for a user-selected property, and update it based on the current brush selection from the parallel coordinates.
- This directly answers: "What is the distribution of strength/hardness in promising candidates?"

### 2.5 Radar Charts ✅ Appropriate (for small comparison subsets)

**Verdict: Appropriate for comparing individual selected candidates.**

- Already implemented in Part 1 of the framework.
- Perfect for the final step in the analysis: after filtering via parallel coordinates and scatter plot, select 3–5 individual alloy candidates and compare their full property profiles.
- **Concern**: Does not scale — showing more than ~5 overlapping polygons becomes unreadable.
- **Recommendation**: Reuse the Part 1 radar chart logic and adapt it to the dashboard selection mechanism. Show only the currently selected (clicked) data points.

---

## 3. Summary of Chart Evaluation

| Chart Type | Spec | Verdict | Reason |
|---|---|---|---|
| Scatter Plot | ✅ | ✅ Appropriate | Pairwise relations between numerical vars; needs sampling/opacity |
| Bubble Chart | ✅ | ⚠️ Conditional | Only useful on brushed/filtered subsets; merge with scatter slot |
| Parallel Coordinates | ✅ | ✅ Most important | Standard for high-dimensional continuous data; endorsed by contest organizers |
| Bar Chart | ✅ | ⚠️ Reframe as histogram | No categories in data; valid only as binned distribution chart |
| Radar Chart | ✅ | ✅ Appropriate | Good for comparing 3–5 selected candidate alloys |

---

## 4. Dashboard Layout Design

The dashboard has **4 chart slots** (chart1–chart4) arranged in a 2×2 grid.

```
┌─────────────────────────────────────┬─────────────────────────────┐
│  Chart 1: Parallel Coordinates      │  Chart 2: Scatter/Bubble    │
│  (Primary overview + brush filter)  │  (Composition vs. Property) │
│  Full-width or dominant             │  Shows brushed subset        │
├─────────────────────────────────────┼─────────────────────────────┤
│  Chart 3: Histogram                 │  Chart 4: Radar Chart        │
│  (Distribution of selected prop.)   │  (Compare selected alloys)  │
└─────────────────────────────────────┴─────────────────────────────┘
```

### Proposed Assignment:

| Slot | Chart | Purpose |
|---|---|---|
| **chart1** | **Parallel Coordinates Plot** | Overview of all variables; axis brushing drives filtering across all other charts |
| **chart2** | **Scatter / Bubble Chart** | Detail view of 2–3 chosen variables (x, y, bubble size); shows filtered/brushed subset |
| **chart3** | **Histogram (Bar Chart)** | Distribution of a user-selected property across all/filtered data |
| **chart4** | **Radar Chart** | Multi-property profile comparison of individually clicked/selected alloy candidates |

---

## 5. Interaction Design

### Coordinated Multiple Views (CMV)
All charts share a common selection/filter state:

1. **Brushing in Parallel Coordinates (chart1)** → filters the displayed data in chart2 (scatter) and chart3 (histogram).
2. **Clicking a point in Scatter Chart (chart2)** → adds that alloy to chart4 (radar chart) for detailed comparison.
3. **Histogram (chart3)** updates to reflect the currently brushed subset from parallel coordinates.
4. **Radar Chart (chart4)** shows only explicitly selected individual alloys.

### Data Flow
```
[CSV Load] → [Parse + Sample to ~5000 rows] → [Shared dataset state]
                                                        ↓
                                          [Parallel Coordinates brush]
                                                 ↓            ↓
                                    [Scatter/Bubble]   [Histogram]
                                          ↓
                                    [Click point]
                                          ↓
                                    [Radar Chart]
```

---

## 6. Data Preprocessing

| Step | Details |
|---|---|
| **Sampling** | Load all rows but render only a random sample of ~5,000 for the parallel coordinates and scatter plot (performance). Allow toggling sample size. |
| **NaN handling** | Replace NaN with 0 for phase volume fractions (phase absent = 0%). Skip NaN for other properties in scale calculations. |
| **Normalization** | Use per-axis min/max scaling in the parallel coordinates (each axis independently normalized to [0,1]). Use raw values for scatter/histogram. |
| **Column grouping** | Tag each column with its category (scrap/composition/phase/property) to allow axis coloring and grouping in the parallel coordinates. |
| **Data pass** | Fix `initDashboard(null)` in `dataVis.js` — it should pass `parsedData` instead of `null`. |

---

## 7. Variable Selection for Charts

### Parallel Coordinates (chart1)
Show a curated subset of dimensions by default, with the ability to toggle groups:
- **Scrap inputs**: KS1295, 6082, 2024, Batterybox, 4043, 3003
- **Key composition**: Si, Cu, Mg, Fe (most influential elements)
- **Key phases**: Vf_FCC_A1, Vf_DIAMOND_A4, Vf_AL15SI2M4 (most common phases)
- **Key properties**: YS (MPa), Hardness (Vickers), Therm. conductivity, Density

### Scatter/Bubble Chart (chart2)
- User-selectable X axis (default: Si content)
- User-selectable Y axis (default: YS in MPa)
- User-selectable bubble size (default: Hardness)

### Histogram (chart3)
- User-selectable column (default: YS in MPa)
- Number of bins: 30 (adjustable)

### Radar Chart (chart4)
- Fixed dimensions: YS, Hardness, Therm. conductivity, Density, El. conductivity, CSC
- Normalized per-axis to [0, max] for visual comparability

---

## 8. Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Library | D3.js v7 (already included) | Consistent with existing codebase |
| Rendering | SVG | Consistent with Part 1 |
| Sampling strategy | Random sample on load, re-sample on data reload | Performance with 100K rows |
| Brush implementation | d3.brushY per parallel coordinates axis | Standard PCP interaction |
| Color encoding | Category color per axis group in PCP; Tableau10 for selected items | Consistency with Part 1 |
| Tooltips | Reuse existing tooltip div from Part 1 | DRY principle |

---

## 9. Key Design Decisions / Justifications

1. **No standalone Bubble Chart slot**: The bubble chart encoding is folded into the scatter chart (size channel already exists in Part 1). Using a separate slot for it would waste space with 100K data points.

2. **Bar chart → histogram reframe**: Given the 100% numerical data, a histogram is the only sensible bar-based visualization. The intent (showing distributions and comparisons) is preserved; only the implementation changes from categorical bars to binned bars.

3. **PCP as primary chart**: Endorsed by both the spec and the SciVis contest organizers. It is the only chart that can show the full input→output pipeline in a single view for this data.

4. **Data fix needed in dataVis.js**: Line 102 calls `initDashboard(null)` — this must be changed to `initDashboard(parsedData)` for the dashboard to receive actual data.

---

## 10. TODOs

### Critical
- [ ] Fix `dataVis.js` line 102: change `initDashboard(null)` to `initDashboard(parsedData)`
- [ ] Implement `initDashboard(_data)` — parse data, create shared state, call all chart initializers
- [ ] Implement `createChart1()` — Parallel Coordinates Plot with axis brush
- [ ] Implement `createChart2()` — Scatter / Bubble Chart with dropdown selectors
- [ ] Implement `createChart3()` — Histogram with dropdown selector
- [ ] Implement `createChart4()` — Radar Chart for selected alloys
- [ ] Implement `clearDashboard()` — full cleanup of all SVG elements and state
- [ ] Implement shared brush/filter state and propagation between charts

### Layout
- [ ] Update `index.html` chart titles to reflect actual chart names
- [ ] Add dropdown menus to chart2 and chart3 containers for axis/variable selection
- [ ] Optionally make chart1 span full width (CSS grid change)

### Data
- [ ] Add NaN → 0 replacement for Vf_* columns on data load
- [ ] Define column groupings (scrap / composition / phase / property) as constants
- [ ] Define default PCP axes selection (curated ~12–15 dimensions)
- [ ] Define default radar axes (6 key property dimensions)

### Optional / Stretch
- [ ] Add a "sample size" slider to control how many rows are rendered
- [ ] Add axis reordering by drag in the parallel coordinates
- [ ] Add correlation highlighting (hover an axis in PCP, color other axes by correlation strength)
- [ ] Add k-means clustering overlay
