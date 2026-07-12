# Alloy Discovery Dashboard — Complete Explanation

## The Challenge: 2025 IEEE SciVis Contest

The [2025 IEEE SciVis Contest](https://sciviscontest2025.github.io/tasks/) addressed a real-world **material science problem**:

> *How can we discover new, high-performance aluminum alloys by recycling mixed scrap metal — supporting a circular economy and climate neutrality?*

### The Data Pipeline (Scrap → Alloy)

```
Scrap Inputs          →    CALPHAD Simulation    →    Alloy Properties
(6 mixture ratios)         (100,000+ alloys)         (phases + mechanical)
```

| Layer | What it contains | Examples |
| --- | --- | --- |
| **Inputs** | Scrap mixture ratios (the "recipe") | `Al_scrap_ratio`, `Si_content`, etc. |
| **Elemental Composition** | 64 resulting chemical elements | `Al`, `Si`, `Fe`, `Cu`, `Mg`, `Mn`… |
| **Phases** | Solidification behaviour | Liquid phase %, solidus temp, hot-cracking sensitivity |
| **Mechanical Properties** | Real-world performance | Yield Strength `YS(MPa)`, Elongation, Hardness |

The challenge was: **"Build a visual analytics tool that helps a materials scientist navigate this 100,000+ row, high-dimensional dataset and identify the best candidate alloys for additive manufacturing."**

The key scientific requirements were:

- **Low hot-cracking sensitivity** (so the alloy doesn't crack during 3D printing)
- **Optimal solidification interval** (narrow range = better printability)
- **High yield strength** and **elongation** (mechanical performance)
- **Understand which scrap inputs drive which properties**

---

## The Dashboard — 5 Views, One Workflow

The dashboard is designed as a **linked, progressive drill-down system**. Each view answers a different question in the scientific workflow. They are all **cross-linked** — selections in one view propagate to all others.

---

## View 1 — Pipeline Overview (Parallel Coordinates)

### What it shows

A multi-axis line chart where **every line = one alloy** and **every vertical axis = one variable** (scrap inputs, element ratios, properties).

### Why this chart?

Parallel Coordinates is the **gold standard for high-dimensional data exploration**. The dataset has 70+ variables. A scatter plot can only show 2 at once. A heatmap shows aggregated correlations. Parallel Coordinates shows all dimensions **simultaneously for every data point**, letting users see patterns and outliers that span the entire pipeline.

### How to get insight

| Action | What you learn |
| --- | --- |
| **Brush one axis** (drag a range) | Instantly filter to alloys meeting that property threshold |
| **Brush multiple axes** | Apply multiple constraints simultaneously (e.g. high YS *and* low cracking) |
| **Watch the line patterns** | Alloys that share similar line trajectories cluster visually — revealing natural groupings |
| **Reset selection button** | Go back to all alloys |

> **Example workflow:** Brush `YS(MPa)` to the top 20%. The lines from the scrap input axes will converge → revealing which input ratios produce high-strength alloys.

---

## View 2 — Correlation Heatmap

### What it shows

A matrix of **Pearson correlation coefficients** between all inputs (rows = scrap/element drivers) and all outputs (columns = properties/phases). Color goes from **Red (r = -1, strong negative)** through White (no correlation) to **Blue (r = +1, strong positive)**.

### Why this chart?

The heatmap answers the macro-level question: **"Which inputs matter for which outputs?"** before diving into individual alloys. It gives the scientist a bird's-eye view of the entire input-output relationship space at once. No other chart type can do this for 70×70 variable pairs.

### How to get insight

| Action | What you learn |
| --- | --- |
| **Scan for dark blue/red cells** | These are the strongest driver relationships in the dataset |
| **Hover any cell** | Shows the exact correlation value `r = x.xx` |
| **Click any cell** | Automatically sets the X and Y axes of the Candidate Explorer (View 3) to that pair |

> **Example insight:** If `Si_content → hot_cracking_sensitivity` is bright blue (r ≈ 0.8), that tells you: **more silicon = much higher cracking risk**. This is actionable knowledge for scrap recipe design.

---

## View 3 — Candidate Explorer (Scatter / Bubble Chart)

### What it shows

An interactive scatter plot with **every alloy as a point**. You control:

- **X axis** → any numeric variable
- **Y axis** → any numeric variable
- **Bubble Size (optional)** → a third variable encoded as circle radius

When a selection is made in View 1 (Parallel Coordinates), the brushed alloys are **highlighted** here and the rest are dimmed.

### Why this chart?

A scatter plot is the best tool for seeing **bi-variate relationships and trade-offs**. In materials science, there are always trade-offs (e.g., you can't maximize both yield strength *and* ductility — the "banana curve"). The Candidate Explorer lets scientists visualize these trade-offs and spot the **Pareto-optimal candidates** (top-right corner of the plot = best on both axes).

The **bubble mode** adds a 3rd dimension: you can encode hot-cracking sensitivity as bubble size — immediately seeing which high-YS, high-elongation candidates are also safe to print.

### How to get insight

| Action | What you learn |
| --- | --- |
| **Plot YS vs Elongation** | The classic strength/ductility trade-off curve |
| **Add Bubble Size = cracking_sensitivity** | Identify candidates that excel on both mechanical axes *and* are printable |
| **Click any point** | Sends that alloy to Views 4 (Alloy Profile) for deep inspection |
| **Filtered by brush from View 1** | Only the brushed alloys are visible — so you're looking at pre-filtered candidates |

> **Example workflow:** Use View 1 to filter alloys with solidification interval &lt; 50°C. Then in View 3, plot YS vs Elongation. The remaining visible points are all printable candidates — find the one in the top-right corner.

---

## View 4 — Alloy Profile (Radar Chart + Bar Chart)

### What it shows

Two side-by-side charts for a **single selected alloy** (clicked in View 3):

| Sub-chart | Shows |
| --- | --- |
| **Radar Chart (left)** | Multi-dimensional property fingerprint — the shape of the alloy across all mechanical/phase properties, overlaid against the dataset average |
| **Bar Chart (right)** | Elemental composition breakdown — exact weight percentages of each element in the alloy |

### Why these charts?

- **Radar chart** is ideal for comparing a single entity across many dimensions. The polygon **shape** encodes the overall "profile" of an alloy at a glance. A large area = generally high-performing. A lopsided shape = unbalanced (strong in some areas, weak in others).
- **Bar chart** for composition is the clearest way to show proportional breakdown. The exact element percentages are the "recipe" — scientists need this to reproduce or tweak the alloy.

### How to get insight

| Action | What you learn |
| --- | --- |
| **Blue polygon** | The global dataset average — the "baseline" alloy |
| **Red polygon** | Your selected candidate |
| **Red &gt; Blue on an axis** | Your candidate outperforms the average on that property |
| **Bar chart elements** | Exact elemental composition — can the scrap stream actually produce this? |

> **Example insight:** You click a promising alloy from View 3. The radar shows it dominates the average on YS and Hardness but is equal on Elongation. The bar chart shows it's 91% Al, 8% Si — a recipe that's achievable from most aluminum scrap streams.

---

## View 5 — Sensitivity Analysis (Horizontal Bar Chart)

### What it shows

A ranked horizontal bar chart showing the **Spearman rank correlation** between every input variable and a single chosen target property. Bars going **right (blue)** = positive correlation. Bars going **left (red)** = negative correlation. The longer the bar, the stronger the influence.

### Why this chart?

Sensitivity Analysis answers the most important engineering question: **"Which levers can I pull to improve this property?"** A materials engineer designing a scrap mix needs to know if they should increase Si, decrease Fe, or change the Al ratio to maximize yield strength. This chart tells them immediately, ranked by influence strength.

Spearman correlation is used (vs Pearson) because it is **robust to non-linear relationships** — which are common in CALPHAD-based alloy physics.

### How to get insight

| Action | What you learn |
| --- | --- |
| **Select target = YS(MPa)** | See which elements and scrap ratios drive strength |
| **Select target = hot_cracking** | See which inputs increase printing risk |
| **Longest positive bar** | The biggest lever for increasing your target |
| **Longest negative bar** | The biggest lever for decreasing your target (desirable for hot-cracking!) |

> **Example insight:** Sensitivity analysis for `hot_cracking_sensitivity` shows `Si_content` as the longest negative bar (r = -0.72). This means: **the more silicon in the scrap, the lower the cracking risk**. This directly informs which scrap material to prioritize.

---

## The Complete Scientific Workflow

```
1. ORIENT        →  Parallel Coordinates: understand the space, apply property thresholds
         ↓
2. CORRELATE     →  Heatmap: identify which inputs most strongly relate to key outputs
         ↓
3. EXPLORE       →  Candidate Explorer: visually find the Pareto-optimal candidates
                    (click heatmap cell to pre-select axes)
         ↓
4. INSPECT       →  Alloy Profile: deep-dive into a specific promising candidate
                    (click a point in Candidate Explorer to profile it)
         ↓
5. EXPLAIN       →  Sensitivity Analysis: understand the physical mechanism behind
                    why that alloy performs the way it does
```

## How the Dashboard Addresses Each Contest Requirement

| Contest Requirement | How the Dashboard Solves It |
| --- | --- |
| Navigate 100,000+ alloys | Parallel Coordinates with interactive brushing |
| Understand input→output relationships | Correlation Heatmap + Sensitivity Analysis |
| Find alloys meeting multiple property targets | Multi-axis brushing in Parallel Coordinates |
| Trade-off analysis | Candidate Explorer scatter/bubble chart |
| Deep inspection of specific candidates | Alloy Profile (Radar + Bar) |
| Understand which inputs to change | Sensitivity Analysis (Spearman rank bars) |
| Cross-view linked selections | AppState event system — all 5 views stay in sync |
| Additive manufacturing suitability | Filter for low solidification interval + hot-cracking sensitivity via brushing |
