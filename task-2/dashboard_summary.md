# Alloy Design Explorer — Dashboard Summary

Interactive dashboard for the IEEE SciVis Contest 2025 dataset
(*Dataset_VisContest_Rapid_Alloy_development_v3*): high-throughput CALPHAD simulations of
recycled aluminium alloys, mixed from six scrap sources via Latin hypercube sampling.
This document describes the final, single-design dashboard. The full decision log —
including why three prototype designs were reduced to this one — lives in
`EMBEDDING_DECISIONS.md`.

---

## 1. Dataset

| Property | Value |
|---|---|
| Rows | 324,632 alloy candidates (verified) |
| Columns | 70 — 6 scrap-mixture fractions, 12 chemical elements, 15 phase volume fractions (`Vf_*`), solidification temperatures, ~20 derived material properties |
| Structure | Scrap fractions sum to exactly 100 % per row (5-D simplex input space); all 64 outputs are deterministic functions of the 6 inputs |
| Missing data | Only 3 columns are fully NaN (`Vf_MG2ZN3`, `T_AL3X`, `T_MG2ZN3` — phases that never form); otherwise complete |
| File | 223 MB tab-separated text, latin-1 encoded |

## 2. Scientific goal

Help materials engineers screen recycled-scrap alloy candidates by answering (matching
the official contest tasks):

1. **Overview** — what does the whole design space look like, across all candidates?
2. **Correlation / sensitivity** — how do scrap mixtures drive composition, composition
   drive phase formation, and phases drive properties?
3. **Exploration & comparison** — which individual candidates combine favorable
   properties (strength, hardness, thermal conductivity, low density, low hot-crack
   susceptibility)?

## 3. Architecture & data strategy

- **Tech stack**: React 19 + D3 v7 + Tailwind CSS v4, built with Vite.
- **Streaming loader** (`src/utils/dataLoader.js`): the 223 MB file is consumed as a byte
  stream and parsed line-by-line directly into one flat `Float32Array`
  (324,632 × 70 ≈ 91 MB). No full-file string and no per-row objects are ever created for
  the full dataset. Works identically for the auto-loaded file and drag-and-drop uploads.
- **Full-data statistics**: axis extents, heatmap density bins, brush-filter counts, and
  the PCA fit are computed over *all* rows of the typed table.
- **Display sample**: only the individually drawn marks (PCP polylines, embedding dots,
  drill-down points) come from a deterministic uniform sample of 10,000 rows — beyond
  that, marks saturate the pixels and add nothing. Every number the user reads comes from
  the complete data.
- **Measured footprint**: with the full dataset loaded, PCA fitted, and after
  brushing/selecting, the JS heap is **~125–127 MB of Chrome's 4,096 MB per-tab limit
  (≈ 3 %)**. Loading takes ~10–15 s with a progress bar and cannot realistically crash a
  PC.

## 4. The four charts

All views are coordinated: brushing a PCP axis filters every chart (true counts over all
324,632 rows shown in the header), and candidates clicked in charts 2 or 3 appear in
chart 4.

### 1 — Parallel Coordinates Plot (Canvas density)
Axes ordered **scrap → elements → phases → properties**, mirroring the physical causality
chain. Low-alpha canvas rendering turns line overdraw into density bands instead of
spaghetti. Vertical brushes on any axis are the dashboard's global filter; a "Clear
filters" button in the header removes them all.

### 2 — PCA Embedding Scatter Plot
PCA fitted on **all 324,632 rows** (chunked, non-blocking, with progress). Each dot is one
alloy projected onto PC1/PC2 (~62 % of total variance), colored by a selectable property
(default yield strength). **Loading vectors** show which variables drive each direction —
the contest's sensitivity question; **KDE contours** show where the filtered design space
concentrates. Feature-set selector (all / composition / phases / properties) refits on
demand. Clicking a dot adds the alloy to the radar comparison.

### 3 — 2D Density Heatmap & Drill-down Scatter
20 × 20 grid of log-scale counts over the full dataset for any variable pair — the
overplotting-proof replacement for a raw scatter/bubble plot. Clicking a cell drills down
to individual alloys (bubble size = third variable) for inspection and selection.

### 4 — Radar Chart — Candidate Comparison
Up to 5 selected candidates overlaid across key properties (YS, hardness, thermal and
electrical conductivity, density, CSC), with a chips row for managing the selection. Axes
are normalized to the full-dataset range; a caption explains this when ≥ 2 candidates are
compared. Five overlays is the radar's readability limit and is enforced.

## 5. Deviations from the original specification sheet (and why)

- **Scatter/bubble chart → density heatmap + drill-down**: a raw scatter of 324k points is
  a solid blob; the heatmap shows true local counts, and the drill-down restores per-alloy
  bubbles at a readable zoom.
- **Histogram/bar chart → dropped**: univariate distributions are already visible along
  each PCP axis; with four slots, a 1D view doesn't earn its space against the contest's
  multi-dimensional tasks.
- **PCA (spec-optional) → core chart**: the contest explicitly asks for embedding-space
  overviews of all candidates.
- **UMAP → deliberately not shipped**: cannot fit 325k points in-browser, stochastic,
  uninterpretable axes; its cluster-separation benefit is recovered by KDE contours +
  property coloring on the PCA view. (Full comparison table in `EMBEDDING_DECISIONS.md`.)

## 6. How a typical screening session works

1. Load finishes → header shows *324,632 / 324,632 alloys*.
2. Brush `YS(MPa)` high and `Density` low on the PCP → header shows the true count of
   candidates meeting both constraints; embedding dims everything else and re-draws its
   density contours around the surviving region.
3. Switch the heatmap to `Si` vs `Therm.conductivity` to check the trade-off inside the
   filtered set; drill into a dense cell and click promising alloys.
4. Compare the picked candidates in the radar; remove chips until the shortlist stands.
