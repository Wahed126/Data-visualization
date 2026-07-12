# 5-Minute Presentation Script: Alloy Discovery Dashboard
**Target Audience:** Scientific / Data Visualization Judges (SciVis 2025)
**Estimated Time:** 5 Minutes (approx. 650 words)

---

## ⏱️ Minute 0:00 - Introduction & The Challenge
**[Slide 1: Title Slide / The Circular Economy]**

"Hello everyone. Today, I’m excited to present our solution to the 2025 IEEE SciVis Contest. 

We are facing a global sustainability challenge: How can we reduce the carbon footprint of the aluminum industry? The answer lies in the **circular economy**—recycling mixed scrap metal instead of mining new bauxite. 

However, scrap metal is messy. When you mix different scrap streams, you get trace elements that can ruin the final alloy, making it crack during 3D printing or fail under stress. 

Our dataset consists of over **100,000 CALPHAD-simulated alloys**, tracking 70 different variables from the initial scrap mix, to the chemical elements, to the final mechanical properties. The challenge we solved was: *How do we build a visual analytics tool that helps materials scientists navigate this massive, high-dimensional space to discover the perfect recycled alloys?*"

---

## ⏱️ Minute 1:00 - The Architecture & Overview
**[Slide 2: Show the Full Dashboard]**

"To solve this, we built a highly responsive, web-based dashboard using a Python backend and a raw D3.js frontend. By decoupling the heavy data processing from the browser, we are able to explore all 100,000 alloys in real-time without crashing the user's browser.

Our dashboard is built around a **linked, progressive drill-down workflow**. It consists of 5 cross-linked views that take the scientist from a global overview of the entire dataset, all the way down to the specific chemical recipe of a single printable alloy."

---

## ⏱️ Minute 1:45 - Step 1: Orient & Correlate
**[Slide 3: Highlight Parallel Coordinates & Heatmap]**

"We start broad. **View 1 is our Pipeline Overview**, using Parallel Coordinates. This is the gold standard for high-dimensional data. Every line is an alloy. A scientist can instantly 'brush' the Yield Strength axis to filter for the top 20% strongest alloys, and watch how the lines trace back to reveal which scrap inputs were used to make them.

Next, before diving into individual points, the scientist needs to know *what variables actually matter*. **View 2 is our Correlation Heatmap**. By scanning for deep blue or dark red squares, they can instantly spot global relationships—for example, discovering at a glance that adding Silicon drastically increases hot-cracking sensitivity. Clicking any cell here automatically configures the next view."

---

## ⏱️ Minute 2:45 - Step 2: Explore the Trade-offs
**[Slide 4: Highlight Candidate Explorer]**

"This brings us to **View 3: The Candidate Explorer**. Engineering is entirely about trade-offs. You rarely get high strength *and* high ductility. 

This scatter and bubble chart allows the scientist to plot these trade-offs visually to find the 'Pareto Front'—the optimal edge of the data. For instance, they can plot Yield Strength against Elongation, and use the bubble size to encode 'Hot Cracking Sensitivity'. 

By looking at the top-right corner of the chart, they can easily spot the 'holy grail' candidates: points that are strong, ductile, and—because they have small bubbles—are safe for additive manufacturing."

---

## ⏱️ Minute 3:30 - Step 3: Inspect the Physical Recipe
**[Slide 5: Highlight Alloy Profile]**

"Once they find a promising candidate in the scatter plot, they click it. This instantly populates **View 4: The Alloy Profile**. 

This view fetches the exact 70-column fingerprint of that specific alloy. The **Radar Chart** visualizes its mechanical performance, overlaying the selected candidate in red on top of the global dataset average in blue. A larger red shape instantly communicates a superior alloy.

Right beside it, the **Bar Chart** gives them the exact chemical recipe—the precise weight percentages of Aluminum, Silicon, Copper, and Magnesium needed to melt and recreate this alloy in the real world."

---

## ⏱️ Minute 4:15 - Step 4: Explain & Act
**[Slide 6: Highlight Sensitivity Analysis]**

"Finally, we wanted to answer the most important engineering question: *Which lever do I pull to fix a problem?*

**View 5 is our Sensitivity Analysis**. It uses Spearman rank correlation to show the dominant drivers for any target property. If a scientist selects 'hot-cracking', this chart will rank the inputs. A long bar pointing left tells the engineer exactly what to do—for example, 'Reduce Silicon to stop this alloy from cracking.' It turns data exploration into actionable engineering instructions."

---

## ⏱️ Minute 4:45 - Conclusion
**[Slide 7: Summary & Thank You]**

"In conclusion, our dashboard takes an overwhelming, 100,000-row simulation and turns it into a clear, 5-step scientific workflow: Orient, Correlate, Explore, Inspect, and Explain. 

By empowering scientists to easily navigate this complex data, we accelerate the discovery of high-performance recycled alloys, bringing us one step closer to a sustainable, circular economy. 

Thank you."
