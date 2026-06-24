# Alloy Design Space Dashboard: Project Summary & Proposal

This document summarizes the dataset, requirements, purpose, current visualization techniques, their limitations, and questions regarding future visualization improvements for the recycled aluminium alloy exploration dashboard.

---

## 1. Dataset Summary
The dashboard works with the **Dataset_VisContest_Rapid_Alloy_development_v3** dataset from the IEEE SciVis Contest 2025, which represents high-throughput simulations of recycled aluminium alloy screening.
*   **Size**: A large multidimensional dataset (~100,000+ rows, 223 MB raw text).
*   **Variables**:
    1.  **Scrap Mixture Inputs**: Proportions of recycled scrap source materials (e.g., piston alloys `KS1295[%]`, battery box scraps, `3003[%]`, `6082[%]`).
    2.  **Chemical Composition**: Final concentrations of chemical elements (e.g., `Al`, `Si`, `Cu`, `Mg`, `Fe`).
    3.  **Phase Formations**: Predicted crystallographic phases formed during solidification (e.g., FCC matrix `Vf_FCC_A1`, silicon phase `Vf_DIAMOND_A4`, intermetallics).
    4.  **Mechanical & Physical Properties**: Resulting alloy properties (e.g., Yield Strength `YS`, Vickers hardness, density, electrical and thermal conductivity).

---

## 2. Requirements
*   **Tech Stack**: Built with React (component-driven architecture), D3.js (custom SVGs and animations), and Tailwind CSS (v4).
*   **Design & Theme**: A minimalist, high-contrast **Light Mode** styling prioritizing interactivity, axis readability, and performance.
*   **Interactivity**: Coordinated views where interaction (brushing/selection) in one view dynamically filters and updates the other charts.
*   **Performance**: Handle large datasets efficiently by using deterministic uniform sampling (5,000 rows for PCP, 2,000 rows for scatter plots) and react transitions to avoid UI blocking.

---

## 3. Purpose and Goal
The scientific goal of the application is to guide materials engineers in screening and developing **new sustainable materials from scrap metals** for industries like automotive and aerospace.
Specifically, it aims to answer:
1.  How do varying scrap mixtures influence final chemical compositions?
2.  How does final composition affect crystallographic phase formations?
3.  Which compositions lead to optimal material property trade-offs (e.g., maximizing strength and thermal conductivity while minimizing density)?
4.  Which individual alloy candidates are most promising for potential industrial applications?

---

## 4. Current Charts & Shortcomings

### A. Parallel Coordinates Plot (PCP)
*   **Role**: Provides a high-dimensional overview across inputs, phases, and properties.
*   **Shortcoming ("Spaghetti Effect")**: When rendering thousands of lines, the paths overlap into a solid block of color. It is difficult to trace individual paths across more than two adjacent axes, making patterns obscure without active brushing.

### B. Scatter / Bubble Chart
*   **Role**: Explores pairwise relationships with circle size encoding a third variable.
*   **Shortcoming (Overplotting)**: Dense continuous points overlap heavily, forming solid blobs. This obscures the local density of points (making it impossible to tell if a region has 10 points or 500 points) and hides outliers near the cluster boundary.

### C. Histogram
*   **Role**: Displays the frequency distribution of a selected parameter.
*   **Shortcoming (Single Variable focus)**: Renders a static 1D frequency count, which doesn't capture joint correlations or multidimensional trade-offs of the filtered dataset.

### D. Radar Chart
*   **Role**: Overlays selected candidates across key properties for profile comparison.
*   **Shortcoming (Overlap Limits)**: Overlaying more than 5 candidates results in intersecting polylines that are visually chaotic and unreadable.

---

## 5. Chart Improvements Feedback Request

To resolve the scatter plot overplotting and parallel coordinate line clutter, several techniques could be deployed:
- **Hexagonal Binning (Hexbins)** or a **2D Heatmap Grid**: Aggregating overlapping points into grid cells colored by density (making clusters immediately clear, though individual alloy selection would require a zoom-to-scatter detail view).
- **Scatter Plot Matrix (SPLOM)**: To explore multiple pairwise elements simultaneously.
- **Contour Density Lines**: Applied as an overlay over the scatter plot.
- **Interactive Opacity Slider Controls**: Let users fine-tune point transparency dynamically in the UI.

We would appreciate your feedback on which of these approaches—or other chart alternatives—best aligns with your workflow and evaluation goals.
