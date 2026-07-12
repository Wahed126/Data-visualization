# SciVis 2025 Dashboard: Presentation & Q&A Prep

**Course/Context:** Data Visualization
**Professor:** Prof. Dr. Christoph Heinzl
**Assistant:** Alexander Gall (University of Passau)
**Duration:** 5 Min Presentation + 10 Min Q&A

---

## Part 1: 5-Minute Presentation Script

### 1. Introduction (0:30)
"Hello everyone. Today I'll present my visual analytics dashboard for the IEEE SciVis 2025 Contest. The challenge was to help material scientists explore a massive dataset of over 100,000 simulated aluminium alloys, tracing the pipeline from scrap metal inputs, to chemical elements, phases, and finally material properties."

### 2. Why use an API instead of loading data in the frontend? (1:30)
"I made a crucial architectural decision early on: using a Python Flask backend API instead of loading the dataset directly in D3.js. The raw dataset is a 212MB text file with over 70 columns. When I initially tried to load this in the browser, it caused ERR_CONNECTION_RESET and crashed the browser tab due to memory limits. By using an API:

- **Performance:** The Python backend loads the dataset once into a global Pandas DataFrame.
- **Heavy Lifting:** The backend computes complex statistics (like Pearson and Spearman correlations) in milliseconds.
- **Data Caps:** Instead of sending 100,000 rows, the API sends a representative sample of 5,000 rows for scatter plots, or pre-aggregated averages for bar charts. The frontend only receives lightweight JSON payloads, making the dashboard incredibly fast."

### 3. Why these specific charts? (1:30)
"To tackle the visual steering and multi-dimensional nature of the dataset, I designed a 5-view coordinated layout:

- **Parallel Coordinates:** Perfect for the 'Pipeline Overview'. It allows users to trace a line from input scrap all the way to mechanical properties, and use brushing to filter thousands of alloys at once.
- **Correlation Heatmap:** Instantly reveals linear relationships (Pearson) between inputs and outputs.
- **Candidate Explorer (Scatter/Bubble):** Allows the user to drill down into 2 or 3 specific dimensions to find clusters or outliers.
- **Alloy Profile (Radar & Stacked Bar):** A Radar chart is the best way to compare a multivariate profile (like 10 material properties) of a selected alloy against the global average. The stacked bar cleanly shows chemical composition.
- **Sensitivity Analysis:** A horizontal bar chart using Spearman correlation to explicitly answer 'which scrap input drives this specific property?'"

### 4. Source Code Explanation (1:30)
"The codebase is divided cleanly between backend and frontend.

- **Backend (helpers.py & api.py):** I built a DataHelper class that loads the data eagerly on startup. It exposes endpoints like /api/chart/heatmap and uses Pandas .corr() to compute matrices on the fly.
- **Frontend (appState.js & main.js):** I implemented a custom Global State Manager (AppState) using a Publisher/Subscriber pattern.
- **Decoupled D3 (js/charts/):** Because of appState.js, the D3 charts don't need to know about each other. When a user brushes the Parallel Coordinates, it emits a brushChange event. The Scatter Plot and Radar Chart simply listen for this event and update their opacities and data dynamically."

---

## Part 2: 10-Minute Q&A Preparation

Prof. Heinzl focuses heavily on volume graphics, visual analytics, and information visualization fundamentals. Alexander Gall handles practical implementation. Here is what they are likely to ask:

### 1. "How did you handle visual clutter in the Scatter Plot and Parallel Coordinates with 100,000 rows?"
**Your Answer:** "Overplotting is a major issue with this dataset. I handled it in two ways:

- **Backend Sampling:** The API limits raw point delivery to a random reproducible sample of 5,000 points (df.sample(n=5000)). This is statistically representative of the shape of the data without rendering 100,000 SVG elements.
- **Visual Encoding (Alpha Blending):** In D3, I set the stroke/fill opacity of unselected lines to 0.15. When a user brushes, the selected lines are bumped to opacity 1.0 and moved to the front (.raise()), making the signal pop out from the noise."

### 2. "You used Pearson correlation for the heatmap and Spearman for Sensitivity. Why both?"
**Your Answer:** "Pearson assumes a linear relationship and normal distribution, which gives a good general overview in the Heatmap of how two variables move together. Spearman evaluates monotonic relationships (using rank). Material properties often scale non-linearly with scrap inputs (e.g., a property spikes after a certain threshold). Spearman captures these non-linear but directional sensitivities better for the Sensitivity Bar Chart."

### 3. "Is your backend thread-safe? What happens if multiple users access the API?"
**Your Answer:** "Yes. The DataHelper class loads the Pandas DataFrame once into memory on startup. All my API endpoints (like get_sample or get_correlation_matrix) perform read-only operations or use out-of-place Pandas methods (like .sample() or .corr()). Because I don't mutate the global DataFrame in place, Flask can handle multiple concurrent GET requests safely."

### 4. "What was the hardest part of coordinating the views?"
**Your Answer:** "Managing state. Initially, passing data directly from chart to chart creates a tangled mess (spaghetti code). I solved this by implementing appState.js as an Event Bus. The Parallel Coordinates chart doesn't tell the Scatter plot to update; it just tells appState that the brush changed. The Scatter plot subscribes to that state. This decoupled architecture makes the frontend highly scalable."

### 5. "How would you improve this dashboard if you had another month?"
**Your Answer:** "I would implement backend-driven cross-filtering. Right now, the backend samples 5k rows, and brushing highlights those rows on the frontend. Ideally, brushing on the frontend would send a query back to the API (WHERE YS(MPa) > 200), and the API would recalculate the averages, correlations, and resample the data based only on that filtered subset. I would also use WebGL (via Three.js or Deck.gl) instead of SVG to render all 100,000 points smoothly."
