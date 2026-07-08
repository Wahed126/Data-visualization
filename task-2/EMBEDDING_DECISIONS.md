# Design & Data-Strategy Decisions — Alloy Design Explorer (Final)

This document records the final design of the dashboard: which of the three prototype
designs was kept, which charts were chosen and why (including where and why they deviate
from the specification sheet), the data-loading strategy for the 324,632 × 70 dataset, and
the embedding decision (PCA vs. UMAP). All claims about the data were verified
programmatically against the real file.

---

## 1. What the contest actually expects

From the official task list (https://sciviscontest2025.github.io/tasks/):

- **Challenge 1, Task 1 — Multi-dimensional visualization**: "generate overview on *all*
  simulated candidate materials", explicitly suggesting "dimensionality reduction,
  embedding spaces" and visualizing "correlations in in- and outputs as well as the
  sensitivity of specific inputs on respective outputs".
- **Challenge 1, Task 2 — Explorative visualization**: interactive "exploration and
  comparison of candidates with respect to composition – microstructure – properties".
- **Challenge 2 — Visual steering**: interactive tools that show in which direction an
  optimization should move (input sensitivity / output stability).

Three consequences drove every decision below:

1. "**All** simulated candidate materials" — statistics must come from the full 324,632
   rows, not a sample.
2. An **embedding is expected**, and it must support the *sensitivity/correlation* story —
   i.e. it must be interpretable, not just pretty clusters.
3. **Candidate comparison** must be a first-class interaction, not an afterthought.

## 2. Final design: one dashboard, four charts

The three prototype designs (A: Standard, B: Density-Aware, C: Embedding) were built to
compare approaches. The final dashboard keeps the strongest chart from each and removes the
rest:

| # | Chart | Origin | Contest task it serves |
|---|---|---|---|
| 1 | **Parallel Coordinates (Canvas density)**, axes ordered scrap → elements → phases → properties | Design B | Task 1: correlations across the full in→out pipeline; also the dashboard's global filter (axis brushing) |
| 2 | **PCA design-space embedding** with loading vectors + KDE contours, fitted on all 324,632 rows | Design C | Task 1: "overview on all candidates" via "embedding spaces"; loadings answer the sensitivity question |
| 3 | **2D density heatmap with drill-down** (log-scale counts over the full dataset, click a cell to see individual alloys) | Design B | Task 1→2 bridge: overview-first pairwise correlation, then zoom to candidate level |
| 4 | **Radar candidate comparison** (up to 5 selected alloys) | Design A | Task 2: direct multi-property comparison of shortlisted candidates |

Deleted: `CoordinatedDashboard`, `AdvancedDashboard`, `EmbeddingDashboard`,
`ParallelCoordinates` (SVG), `ScatterBubbleChart`, `Histogram`, `JointDensityHeatmap`,
`SmallMultiplesRadar`, and the view-switching logic in `App.jsx`.

### Why these charts and not (exactly) the specification sheet's list

The spec sheet named scatter plot, bubble chart, parallel coordinates, bar charts, radar
charts. Deviations and reasons:

- **Plain scatter/bubble chart → density heatmap with drill-down.** At 324,632 points a
  scatter plot is a solid ink blob: it cannot distinguish a cell with 10 alloys from one
  with 5,000, which is precisely the information a screening tool needs. The bubble-size
  channel is unreadable under that overplotting. The heatmap shows *true* counts of the
  full dataset on a log color scale, and the drill-down restores the spec's original
  intent (inspect and select individual alloys, with bubble size as the third variable)
  at a zoom level where points are actually distinguishable. Nothing is lost; the scale
  problem is solved.
- **Bar chart / histogram → dropped.** A 1D frequency plot is the least
  information-dense of the candidates: its content is already visible as the value
  distribution along each PCP axis and the marginals of the heatmap. With four slots and
  the contest explicitly asking for *multi*-dimensional overview, correlation, and
  comparison views, a univariate chart doesn't earn its space. (The spec's "distributions
  and comparisons" purpose is fully covered by the PCP + heatmap.)
- **Parallel coordinates → kept, but Canvas with alpha-density rendering.** The SVG
  version (Design A) degrades into spaghetti and DOM-node overload; low-alpha canvas
  stacking turns overdraw into a feature (density bands) instead of a bug.
- **Radar → kept** exactly as specified (capped at 5 overlays, which is its readability
  limit).
- **PCA embedding → promoted from "optional" to core chart.** The contest names
  dimensionality reduction/embedding spaces explicitly in Task 1; it is the only view that
  shows the shape of the whole design space at once.

## 3. Data strategy: stream everything, aggregate on all rows, draw a sample

**The problem.** The naive pipeline (`fetch().text()` or `FileReader.readAsText` → d3
parse → array of row objects) materializes the 223 MB file as a ~450 MB UTF-16 string plus
hundreds of MB of per-row objects — this is what crashes ordinary machines. The previous
workaround (parse everything, keep 5,000 rows) still paid the full string cost and then
threw away 98.5 % of the data.

**The solution implemented** (`src/utils/dataLoader.js`):

1. **Streaming parse.** The file is consumed as a byte stream
   (`response.body` / `File.stream()`) with a chunked `TextDecoder` (latin-1, matching the
   file's encoding), parsed line-by-line **directly into one flat `Float32Array`**
   (324,632 × 70 ≈ 91 MB). No full-file string, no 324k row objects — peak memory stays
   near the size of the typed array. A progress bar tracks bytes consumed; the same code
   path serves the auto-loaded dataset and drag-and-drop uploads of any size.
2. **Full-data aggregates.** Everything statistical is computed over *all* rows of the
   typed table: column extents, the heatmap's density bins, the brush filter mask and the
   "N of 324,632 alloys" count (`computeFilterMask`, a few million comparisons ≈
   milliseconds), and the PCA fit (chunked two-pass covariance with yields to the event
   loop, so the UI stays responsive; progress is shown).
3. **Display sample for marks only.** Individual visual marks (PCP polylines, embedding
   dots, drill-down points) are drawn from a deterministic uniform sample of 10,000 rows
   whose `__id` is the row index in the full table. Rationale: beyond ~10k rendered marks
   pixels saturate and additional marks change nothing perceptually, while interaction
   (hover, click) degrades. Because the dataset is Latin-hypercube sampled
   (space-filling by construction), a uniform subsample is unbiased. Crucially, the
   *sample only affects which dots/lines are drawn* — every number the user reads
   (counts, densities, variance percentages, axis ranges) comes from the complete data.
4. **StrictMode safety.** The auto-load is guarded with an `AbortController` and the PCA
   fit with an abort callback, so React's development double-mount cannot start two
   concurrent 223 MB parses (this was observed to freeze the tab before the guard).

This is the same architecture used by production big-data tools (aggregate server-side or
in typed arrays, render a bounded number of marks): "lazy loading" of partial files would
be *worse* here, because the contest requires statistics over all candidates — you cannot
brush-filter or fit PCA on data you haven't read. Reading everything once, compactly, is
both feasible (91 MB) and correct.

## 4. PCA vs. UMAP: implement one, and it is PCA

Both were prototyped (Design C had a UMAP toggle). The final dashboard ships **only PCA**,
and `umap-js` was removed. The question is not "which looks nicer" but "which serves the
contest tasks at full-data scale":

| Criterion | PCA | UMAP |
|---|---|---|
| Fits all 324,632 rows in-browser | ✅ two-pass covariance, ~2–4 s chunked, exact | ❌ k-NN graph + epochs on 325k points is minutes and hundreds of MB; only feasible on a sample |
| Interpretability (Task 1 sensitivity/correlations) | ✅ loading vectors literally point from composition to property ("more Cu/Zn → higher YS, higher density") | ❌ axes and distances are meaningless by construction |
| Determinism / reproducibility (a report deliverable) | ✅ same result every run | ❌ stochastic layout, hyperparameter-sensitive |
| Fit to data geometry | ✅ the input space is a linear 5-simplex (scrap fractions sum to 100 %); measured: 2 PCs = 61 % of total variance, 80 % of property-space variance | ➕ resolves nonlinear phase-boundary clusters (it did isolate a detached ~350–400 MPa high-strength cluster in prototyping) |
| Cost | none (150 lines, no dependency) | +dependency, +progress UX, +explaining a stochastic view in the report |

UMAP's one genuine advantage (nonlinear cluster separation) is largely recovered in the
PCA view by the **KDE density contours** and the **color-by-property** encoding: the
high-strength cluster is clearly visible as a separated high-YS region. If a nonlinear
view is ever needed for the report, it can be recomputed offline (Python) as a static
figure — it does not belong in the interactive tool at this data scale.

Measured interpretation of the full-data PCA (validated against NumPy offline):
- **PC1 (~41 %)**: Si/piston-alloy character vs. thermal & electrical conductivity and
  thermal expansion — the KS1295/4032 ↔ wrought-alloy trade-off.
- **PC2 (~21 %)**: Cu/Zn-rich character (2024 + battery-box) driving yield strength,
  Q-phase/θ-Al₂Cu formation and density up, solidus down — the strength ↔ castability axis.

## 5. Verification performed & measured results

- `eslint` clean; `vite build` passes (bundle shrank 448 kB → 324 kB after removing
  the two retired designs and `umap-js`).
- PCA implementation cross-validated against NumPy `eigh` (exact match).
- Live browser test with the full 223 MB file: streams with progress and a responsive UI;
  header shows **324,632 of 324,632 alloys**; PCA fits on all rows with progress and
  renders (PC2 ≈ 21.3 %, matching the offline NumPy value); the heatmap shows the true
  full-data Si–YS correlation band; clicking an embedding dot populates the radar; brushing
  a PCP axis updated the count to **15,042 of 324,632** — computed against the full table.
  No console errors.

### Measured memory footprint — "will loading everything crash the app?"

Measured live via `performance.memory` with the full dataset loaded, PCA fitted on all
rows, and after a round of brushing and candidate selection:

| Metric | Value |
|---|---|
| JS heap in use | **125–127 MB** |
| Chrome per-tab heap limit | 4,096 MB |
| Budget used | **≈ 3 %** |
| Load time (223 MB file, local) | ~10–15 s, with progress bar, UI responsive |
| Console errors | none |

Answer: **no, it will not crash** — and the margin is structural, not lucky. The streaming
parser means the dangerous artifacts of the naive pipeline (a ~450 MB decoded UTF-16
string plus hundreds of MB of per-row objects) never exist at any moment, even
transiently; peak memory is essentially the 91 MB typed array plus the 10k-row display
sample. A machine would need under ~500 MB of free RAM before this became a problem.

Two development-mode pitfalls were found and fixed during verification:

- **React StrictMode double-mount** started *two* concurrent 223 MB streaming parses,
  saturating the main thread (observed as a frozen tab). Fixed with an `AbortController`
  on the auto-load fetch and an abort callback threaded through the chunked PCA fit, so a
  replaced load/fit actually stops instead of running to completion in the background.
- An aborted load must not touch state owned by the load that replaced it (no error
  flash, no premature spinner dismissal) — handled by swallowing `AbortError` explicitly.

## 6. UI decisions

- **"Selected Candidates" overflow fix.** Root cause: the radar card laid the panel out in
  a flex row next to an SVG whose pixel width came from a stale `ResizeObserver`
  measurement, and the flex child had no `min-w-0` — the browser could not shrink the
  chart, so the panel was pushed out of the card (and viewport). Fix: the panel became a
  **wrapping chips row at the top of the radar card** ("Candidates n/5", each chip
  color-matched to its polygon with an × to remove), and *all four* chart containers got
  `min-w-0 overflow-hidden` guards so no chart can ever push content out of its card.
  Verified: 0 px card overflow, no horizontal page scroll.
- **Chart names on top of their containers.** Each card header now carries a numbered
  badge (1–4) plus the explicit chart-type name — *Parallel Coordinates Plot (PCP)*,
  *PCA Embedding Scatter Plot*, *2D Density Heatmap & Drill-down Scatter*, *Radar Chart —
  Candidate Comparison* — with a per-chart accent color (blue/emerald/indigo/amber) so the
  four views are identifiable at a glance.
- **Header stat chips + clear filters.** The top bar shows a live *filtered / total*
  count chip (highlights blue when a filter narrows it), an amber *n selected* chip, and a
  **Clear n filters** button that removes all axis brushes at once (previously each brush
  had to be cleared by hand). Verified live: brush → *16 / 324,632*, one click →
  *324,632 / 324,632*.
- **Selection explanation — added only where necessary.** A short caption appears under
  the radar chart *only when ≥ 2 candidates are selected*, explaining that each polygon is
  one alloy, axes are normalized to the full-dataset range (outer ring = dataset maximum),
  and that a bigger polygon is not automatically better (density and CSC prefer small
  values). This is the one place where the encoding is genuinely non-obvious. The other
  charts' selections (highlighted dots, chips) are self-explanatory, so no captions were
  added there — per the principle of not spending screen space on redundant text.
- The radar's empty state now points to the embedding/drill-down (it referenced the
  deleted scatter/bubble chart).

## 7. Suggested next steps

- A 2D brush in the embedding (currently it receives filters; a lasso would make it
  bidirectional).
- k-means on the PC scores to label phase-regime clusters (spec-optional).
- Move the PCA fit into a Web Worker to eliminate the last few main-thread pauses.
- A "distance to target property profile" ranking for Challenge 2 visual steering.
