/*
 * Data Visualization - Framework
 * Copyright (C) University of Passau
 *   Faculty of Computer Science and Mathematics
 *   Chair of Cognitive sensor systems
 * Maintenance:
 *   2025, Alexander Gall <alexander.gall@uni-passau.de>
 *
 * All rights reserved.
 */

// Part 2 dashboard: coordinated views for recycled aluminium alloy exploration.
// The dashboard uses a shared filtered dataset so brushing/selecting in one chart
// updates the other charts consistently.
let chart1, chart2, chart3, chart4;
let dashboardChart1Svg,
  dashboardChart2Svg,
  dashboardChart3Svg,
  dashboardChart4Svg;

const DASHBOARD_SAMPLE_SIZE = 5000;
const DASHBOARD_SCATTER_LIMIT = 2000;
const DASHBOARD_MAX_SELECTED_ALLOYS = 5;
const DASHBOARD_HISTOGRAM_BINS = 30;

const SCRAP_COLUMNS = [
  "KS1295[%]",
  "6082[%]",
  "2024[%]",
  "bat-box[%]",
  "Batterybox [%]",
  "3003[%]",
  "3003 [%]",
  "4032[%]",
  "4043 [%]",
];
const COMPOSITION_COLUMNS = [
  "Al",
  "Si",
  "Cu",
  "Ni",
  "Mg",
  "Mn",
  "Fe",
  "Cr",
  "Ti",
  "Zr",
  "V",
  "Zn",
];
const DEFAULT_PHASE_COLUMNS = [
  "Vf_FCC_A1",
  "Vf_DIAMOND_A4",
  "Vf_AL15SI2M4",
  "Vf_AL3X",
];
const DEFAULT_PROPERTY_COLUMN_HINTS = [
  "YS(MPa)",
  "YS (MPa)",
  "hardness(Vickers)",
  "Hardness (Vickers)",
  "Therm.conductivity(W/(mK))",
  "Therm. conductivity (W/(m·K))",
  "Density(g/cm3)",
  "Density (g/cm³)",
];
const DEFAULT_RADAR_COLUMN_HINTS = [
  "YS(MPa)",
  "YS (MPa)",
  "hardness(Vickers)",
  "Hardness (Vickers)",
  "Therm.conductivity(W/(mK))",
  "Therm. conductivity (W/(m·K))",
  "Density(g/cm3)",
  "Density (g/cm³)",
  "El.conductivity(S/m)",
  "El. conductivity (S/m)",
  "CSC",
];

const dashboardState = {
  rawData: [],
  data: [],
  filteredData: [],
  dataById: new Map(),
  numericColumns: [],
  parallelDimensions: [],
  radarDimensions: [],
  brushes: {},
  selectedIds: [],
  selectedColors: {},
  colorScale: d3.scaleOrdinal(d3.schemeTableau10),
  xScatterColumn: null,
  yScatterColumn: null,
  sizeScatterColumn: null,
  histogramColumn: null,
};

function initDashboard(_data) {
  clearDashboard();

  if (!_data || _data.length === 0) {
    showDashboardMessage(
      "#chart1",
      "Upload a CSV file to initialize the dashboard.",
    );
    return;
  }

  prepareDashboardData(_data);
  initializeDashboardSelections();
  createDashboardSvgContainers();

  createChart1();
  createChart2();
  createChart3();
  createChart4();
}

function prepareDashboardData(rawData) {
  dashboardState.rawData = rawData;
  dashboardState.brushes = {};
  dashboardState.selectedIds = [];
  dashboardState.selectedColors = {};
  dashboardState.dataById = new Map();

  const allColumns = Object.keys(rawData[0]);
  dashboardState.numericColumns = allColumns.filter(function (column) {
    return rawData.some(function (row) {
      return Number.isFinite(parseNumericValue(row[column]));
    });
  });

  const parsedData = rawData.map(function (row, index) {
    const parsedRow = { __id: index, __label: "Alloy " + (index + 1) };

    allColumns.forEach(function (column) {
      const numericValue = parseNumericValue(row[column]);

      // For phase fractions, NaN generally means that the phase does not form.
      // Treating those cases as 0 keeps the visual encoding scientifically meaningful.
      if (!Number.isFinite(numericValue) && isPhaseFractionColumn(column)) {
        parsedRow[column] = 0;
      } else if (Number.isFinite(numericValue)) {
        parsedRow[column] = numericValue;
      } else {
        parsedRow[column] = row[column];
      }
    });

    return parsedRow;
  });

  dashboardState.data = sampleRows(parsedData, DASHBOARD_SAMPLE_SIZE);
  dashboardState.filteredData = dashboardState.data;
  dashboardState.data.forEach(function (row) {
    dashboardState.dataById.set(row.__id, row);
  });
}

function initializeDashboardSelections() {
  dashboardState.parallelDimensions = buildParallelDimensions();
  dashboardState.radarDimensions = buildRadarDimensions();

  dashboardState.xScatterColumn = findFirstExistingColumn(
    ["Si", "Cu", "Mg"],
    dashboardState.numericColumns,
  );
  dashboardState.yScatterColumn = findFirstExistingColumn(
    ["YS(MPa)", "YS (MPa)", "hardness(Vickers)", "Hardness (Vickers)"],
    dashboardState.numericColumns,
  );
  dashboardState.sizeScatterColumn = findFirstExistingColumn(
    ["hardness(Vickers)", "Hardness (Vickers)", "YS(MPa)", "YS (MPa)"],
    dashboardState.numericColumns,
  );
  dashboardState.histogramColumn = findFirstExistingColumn(
    ["YS(MPa)", "YS (MPa)", "hardness(Vickers)", "Hardness (Vickers)"],
    dashboardState.numericColumns,
  );

  // Generic fallback keeps the dashboard useful for the framework's test datasets too.
  dashboardState.xScatterColumn =
    dashboardState.xScatterColumn || dashboardState.numericColumns[0];
  dashboardState.yScatterColumn =
    dashboardState.yScatterColumn ||
    dashboardState.numericColumns[1] ||
    dashboardState.numericColumns[0];
  dashboardState.sizeScatterColumn =
    dashboardState.sizeScatterColumn ||
    dashboardState.numericColumns[2] ||
    dashboardState.numericColumns[0];
  dashboardState.histogramColumn =
    dashboardState.histogramColumn || dashboardState.numericColumns[0];
}

function createDashboardSvgContainers() {
  dashboardChart1Svg = d3
    .select("#chart1")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  dashboardChart2Svg = d3
    .select("#chart2")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  dashboardChart3Svg = d3
    .select("#chart3")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  dashboardChart4Svg = d3
    .select("#chart4")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  chart1 = dashboardChart1Svg.append("g");
  chart2 = dashboardChart2Svg.append("g");
  chart3 = dashboardChart3Svg.append("g");
  chart4 = dashboardChart4Svg.append("g");
}

// Chart 1: Parallel coordinates overview with per-axis brushing.
function createChart1() {
  const dimensions = dashboardState.parallelDimensions;
  if (dimensions.length === 0) {
    showChartMessage(
      chart1,
      "No numeric dimensions found for parallel coordinates.",
    );
    return;
  }

  const margins = { top: 35, right: 25, bottom: 85, left: 45 };
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const plot = chart1.attr(
    "transform",
    "translate(" + margins.left + "," + margins.top + ")",
  );

  const xScale = d3
    .scalePoint()
    .domain(dimensions)
    .range([0, innerWidth])
    .padding(0.35);
  const yScales = {};

  dimensions.forEach(function (dimension) {
    yScales[dimension] = d3
      .scaleLinear()
      .domain(getFiniteExtent(dashboardState.data, dimension))
      .range([innerHeight, 0])
      .nice();
  });

  const line = d3.line();
  const pathForRow = function (row) {
    return line(
      dimensions.map(function (dimension) {
        return [xScale(dimension), yScales[dimension](row[dimension])];
      }),
    );
  };

  plot
    .append("text")
    .attr("class", "dashboard-chart-note")
    .attr("x", 0)
    .attr("y", -15)
    .text("Brush any axis to filter the scatter/bubble chart and histogram.");

  plot
    .append("g")
    .attr("class", "parallel-lines")
    .selectAll("path")
    .data(
      dashboardState.data.filter(function (row) {
        return dimensions.every(function (dimension) {
          return Number.isFinite(row[dimension]);
        });
      }),
      function (row) {
        return row.__id;
      },
    )
    .enter()
    .append("path")
    .attr("class", "pcp-line")
    .attr("d", pathForRow)
    .attr("fill", "none")
    .attr("stroke", "#4c78a8")
    .attr("stroke-width", 0.8)
    .attr("opacity", 0.12);

  const axes = plot
    .selectAll(".pcp-axis")
    .data(dimensions)
    .enter()
    .append("g")
    .attr("class", "pcp-axis")
    .attr("transform", function (dimension) {
      return "translate(" + xScale(dimension) + ",0)";
    });

  axes.each(function (dimension) {
    d3.select(this).call(d3.axisLeft(yScales[dimension]).ticks(5));
  });

  axes
    .append("text")
    .attr("class", "pcp-axis-label")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-35)")
    .attr("x", -8)
    .attr("y", -10)
    .attr("fill", function (dimension) {
      return colorForColumnGroup(dimension);
    })
    .text(function (dimension) {
      return shortenLabel(dimension, 18);
    });

  axes
    .append("g")
    .attr("class", "pcp-brush")
    .each(function (dimension) {
      d3.select(this).call(
        d3
          .brushY()
          .extent([
            [-12, 0],
            [12, innerHeight],
          ])
          .on("brush end", function (event) {
            if (event.selection) {
              const brushedPixelRange = event.selection;
              dashboardState.brushes[dimension] = [
                yScales[dimension].invert(brushedPixelRange[1]),
                yScales[dimension].invert(brushedPixelRange[0]),
              ];
            } else {
              delete dashboardState.brushes[dimension];
            }

            updateFilteredDataFromBrushes();
            updateParallelCoordinateLineStyles();
            renderScatterBubbleChart();
            renderHistogram();
          }),
      );
    });

  updateParallelCoordinateLineStyles();
}

// Chart 2: Scatter plot with bubble size encoding. This merges the spec's scatter
// and bubble chart into one slot, avoiding two almost identical views.
function createChart2() {
  createSelectControl(
    "#chart2",
    "dashboardScatterX",
    "x",
    dashboardState.numericColumns,
    dashboardState.xScatterColumn,
    function (value) {
      dashboardState.xScatterColumn = value;
      renderScatterBubbleChart();
    },
  );
  createSelectControl(
    "#chart2",
    "dashboardScatterY",
    "y",
    dashboardState.numericColumns,
    dashboardState.yScatterColumn,
    function (value) {
      dashboardState.yScatterColumn = value;
      renderScatterBubbleChart();
    },
  );
  createSelectControl(
    "#chart2",
    "dashboardScatterSize",
    "size",
    dashboardState.numericColumns,
    dashboardState.sizeScatterColumn,
    function (value) {
      dashboardState.sizeScatterColumn = value;
      renderScatterBubbleChart();
    },
  );

  renderScatterBubbleChart();
}

// Chart 3: Histogram. This is the most meaningful bar-chart adaptation for this
// fully numerical dataset.
function createChart3() {
  createSelectControl(
    "#chart3",
    "dashboardHistogramColumn",
    "distribution",
    dashboardState.numericColumns,
    dashboardState.histogramColumn,
    function (value) {
      dashboardState.histogramColumn = value;
      renderHistogram();
    },
  );

  renderHistogram();
}

// Chart 4: Radar chart for a small set of clicked alloy candidates.
function createChart4() {
  renderRadarComparison();
}

function renderScatterBubbleChart() {
  chart2.selectAll("*").remove();

  const xColumn = dashboardState.xScatterColumn;
  const yColumn = dashboardState.yScatterColumn;
  const sizeColumn = dashboardState.sizeScatterColumn;
  if (!xColumn || !yColumn || !sizeColumn) {
    showChartMessage(chart2, "Select numeric variables for x, y, and size.");
    return;
  }

  const margins = { top: 35, right: 25, bottom: 70, left: 70 };
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const plot = chart2.attr(
    "transform",
    "translate(" + margins.left + "," + margins.top + ")",
  );

  const scatterRows = dashboardState.filteredData
    .filter(function (row) {
      return (
        Number.isFinite(row[xColumn]) &&
        Number.isFinite(row[yColumn]) &&
        Number.isFinite(row[sizeColumn])
      );
    })
    .slice(0, DASHBOARD_SCATTER_LIMIT);

  if (scatterRows.length === 0) {
    showChartMessage(chart2, "No rows remain after filtering.");
    return;
  }

  const xScale = d3
    .scaleLinear()
    .domain(getFiniteExtent(scatterRows, xColumn))
    .range([0, innerWidth])
    .nice();
  const yScale = d3
    .scaleLinear()
    .domain(getFiniteExtent(scatterRows, yColumn))
    .range([innerHeight, 0])
    .nice();
  const sizeScale = d3
    .scaleSqrt()
    .domain(getFiniteExtent(scatterRows, sizeColumn))
    .range([3, 12]);

  plot
    .append("g")
    .attr("transform", "translate(0," + innerHeight + ")")
    .call(d3.axisBottom(xScale).ticks(6));
  plot.append("g").call(d3.axisLeft(yScale).ticks(6));

  plot
    .append("text")
    .attr("class", "axis-title")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 48)
    .attr("text-anchor", "middle")
    .text(xColumn);

  plot
    .append("text")
    .attr("class", "axis-title")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .text(yColumn);

  plot
    .append("text")
    .attr("class", "dashboard-chart-note")
    .attr("x", 0)
    .attr("y", -15)
    .text(
      "Showing " +
        scatterRows.length +
        " of " +
        dashboardState.filteredData.length +
        " filtered rows. Click points to compare in radar chart.",
    );

  plot
    .selectAll(".dashboard-dot")
    .data(scatterRows, function (row) {
      return row.__id;
    })
    .enter()
    .append("circle")
    .attr("class", "dashboard-dot")
    .attr("cx", function (row) {
      return xScale(row[xColumn]);
    })
    .attr("cy", function (row) {
      return yScale(row[yColumn]);
    })
    .attr("r", function (row) {
      return sizeScale(row[sizeColumn]);
    })
    .attr("fill", function (row) {
      return dashboardState.selectedIds.includes(row.__id)
        ? dashboardState.selectedColors[row.__id]
        : "#4c78a8";
    })
    .attr("stroke", "#1f2937")
    .attr("stroke-width", function (row) {
      return dashboardState.selectedIds.includes(row.__id) ? 2 : 0;
    })
    .attr("opacity", 0.65)
    .on("click", function (event, row) {
      toggleSelectedAlloy(row.__id);
      renderScatterBubbleChart();
      renderRadarComparison();
    })
    .on("mouseover", function (event, row) {
      showDashboardTooltip(event, row);
    })
    .on("mousemove", function (event) {
      moveDashboardTooltip(event);
    })
    .on("mouseout", hideDashboardTooltip);
}

function renderHistogram() {
  chart3.selectAll("*").remove();

  const column = dashboardState.histogramColumn;
  if (!column) {
    showChartMessage(chart3, "Select a numeric variable for the histogram.");
    return;
  }

  const values = dashboardState.filteredData
    .map(function (row) {
      return row[column];
    })
    .filter(Number.isFinite);

  if (values.length === 0) {
    showChartMessage(chart3, "No values remain after filtering.");
    return;
  }

  const margins = { top: 35, right: 25, bottom: 70, left: 70 };
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const plot = chart3.attr(
    "transform",
    "translate(" + margins.left + "," + margins.top + ")",
  );

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(values))
    .nice()
    .range([0, innerWidth]);
  const bins = d3
    .bin()
    .domain(xScale.domain())
    .thresholds(DASHBOARD_HISTOGRAM_BINS)(values);
  const yScale = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(bins, function (bin) {
        return bin.length;
      }) || 1,
    ])
    .nice()
    .range([innerHeight, 0]);

  plot
    .append("g")
    .attr("transform", "translate(0," + innerHeight + ")")
    .call(d3.axisBottom(xScale).ticks(6));
  plot.append("g").call(d3.axisLeft(yScale).ticks(6));

  plot
    .selectAll(".histogram-bar")
    .data(bins)
    .enter()
    .append("rect")
    .attr("class", "histogram-bar")
    .attr("x", function (bin) {
      return xScale(bin.x0) + 1;
    })
    .attr("y", function (bin) {
      return yScale(bin.length);
    })
    .attr("width", function (bin) {
      return Math.max(0, xScale(bin.x1) - xScale(bin.x0) - 1);
    })
    .attr("height", function (bin) {
      return innerHeight - yScale(bin.length);
    })
    .attr("fill", "#f58518")
    .attr("opacity", 0.85);

  plot
    .append("text")
    .attr("class", "axis-title")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 48)
    .attr("text-anchor", "middle")
    .text(column);

  plot
    .append("text")
    .attr("class", "axis-title")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .text("Count");

  plot
    .append("text")
    .attr("class", "dashboard-chart-note")
    .attr("x", 0)
    .attr("y", -15)
    .text("Distribution of " + values.length + " filtered values.");
}

function renderRadarComparison() {
  chart4.selectAll("*").remove();
  d3.select("#dashboardRadarLegend").remove();

  const dimensions = dashboardState.radarDimensions;
  if (dimensions.length < 3) {
    showChartMessage(
      chart4,
      "At least three numeric dimensions are required for a radar chart.",
    );
    return;
  }

  const selectedRows = dashboardState.selectedIds
    .map(function (id) {
      return dashboardState.dataById.get(id);
    })
    .filter(Boolean);

  if (selectedRows.length === 0) {
    showChartMessage(
      chart4,
      "Click points in the scatter/bubble chart to compare candidate alloys.",
    );
    return;
  }

  const plotRadius = Math.min(width, height) * 0.33;
  const centerX = width / 2;
  const centerY = height / 2 + 5;
  const plot = chart4.attr(
    "transform",
    "translate(" + centerX + "," + centerY + ")",
  );
  const angleStep = (Math.PI * 2) / dimensions.length;

  const scales = {};
  dimensions.forEach(function (dimension) {
    scales[dimension] = d3
      .scaleLinear()
      .domain(getFiniteExtent(dashboardState.data, dimension))
      .range([0, plotRadius]);
  });

  const radarLine = d3
    .lineRadial()
    .radius(function (point) {
      return scales[point.dimension](point.value);
    })
    .angle(function (point) {
      return point.index * angleStep;
    })
    .curve(d3.curveLinearClosed);

  d3.range(1, 5).forEach(function (level) {
    const radiusLevel = (plotRadius * level) / 4;
    plot
      .append("circle")
      .attr("r", radiusLevel)
      .attr("fill", "none")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1);
  });

  dimensions.forEach(function (dimension, index) {
    const angle = index * angleStep - Math.PI / 2;
    const axisX = plotRadius * Math.cos(angle);
    const axisY = plotRadius * Math.sin(angle);

    plot
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", axisX)
      .attr("y2", axisY)
      .attr("stroke", "#9ca3af");
    plot
      .append("text")
      .attr("x", (plotRadius + 18) * Math.cos(angle))
      .attr("y", (plotRadius + 18) * Math.sin(angle))
      .attr(
        "text-anchor",
        Math.abs(Math.cos(angle)) < 0.2
          ? "middle"
          : Math.cos(angle) > 0
            ? "start"
            : "end",
      )
      .attr("alignment-baseline", "middle")
      .text(shortenLabel(dimension, 16));
  });

  const radarRows = selectedRows.map(function (row) {
    return {
      id: row.__id,
      values: dimensions.map(function (dimension, index) {
        return { dimension: dimension, index: index, value: row[dimension] };
      }),
    };
  });

  plot
    .selectAll(".dashboard-radar-shape")
    .data(radarRows, function (row) {
      return row.id;
    })
    .enter()
    .append("path")
    .attr("class", "dashboard-radar-shape")
    .attr("d", function (row) {
      return radarLine(row.values);
    })
    .attr("fill", function (row) {
      return dashboardState.selectedColors[row.id];
    })
    .attr("fill-opacity", 0.1)
    .attr("stroke", function (row) {
      return dashboardState.selectedColors[row.id];
    })
    .attr("stroke-width", 2);

  renderRadarLegend(selectedRows);
}

function renderRadarLegend(selectedRows) {
  const legend = d3
    .select("#chart4")
    .append("div")
    .attr("id", "dashboardRadarLegend")
    .attr("class", "radar-dashboard-legend");

  legend.append("strong").text("Selected candidates");
  selectedRows.forEach(function (row) {
    const entry = legend
      .append("div")
      .attr("class", "radar-dashboard-legend-entry");
    entry
      .append("span")
      .attr("class", "color-circle")
      .style("background-color", dashboardState.selectedColors[row.__id]);
    entry.append("span").text(" " + row.__label);
    entry
      .append("button")
      .attr("type", "button")
      .attr("class", "dashboard-remove-selection")
      .text("×")
      .on("click", function () {
        toggleSelectedAlloy(row.__id);
        renderScatterBubbleChart();
        renderRadarComparison();
      });
  });
}

function updateFilteredDataFromBrushes() {
  const activeBrushDimensions = Object.keys(dashboardState.brushes);

  if (activeBrushDimensions.length === 0) {
    dashboardState.filteredData = dashboardState.data;
    return;
  }

  dashboardState.filteredData = dashboardState.data.filter(function (row) {
    return activeBrushDimensions.every(function (dimension) {
      const value = row[dimension];
      const brushRange = dashboardState.brushes[dimension];
      return (
        Number.isFinite(value) &&
        value >= brushRange[0] &&
        value <= brushRange[1]
      );
    });
  });
}

function updateParallelCoordinateLineStyles() {
  const filteredIds = new Set(
    dashboardState.filteredData.map(function (row) {
      return row.__id;
    }),
  );

  chart1
    .selectAll(".pcp-line")
    .attr("stroke", function (row) {
      return filteredIds.has(row.__id) ? "#4c78a8" : "#d1d5db";
    })
    .attr("opacity", function (row) {
      return filteredIds.has(row.__id) ? 0.18 : 0.025;
    });
}

function toggleSelectedAlloy(id) {
  const currentIndex = dashboardState.selectedIds.indexOf(id);
  if (currentIndex === -1) {
    if (dashboardState.selectedIds.length >= DASHBOARD_MAX_SELECTED_ALLOYS) {
      const removedId = dashboardState.selectedIds.shift();
      delete dashboardState.selectedColors[removedId];
    }

    dashboardState.selectedIds.push(id);
    dashboardState.selectedColors[id] = dashboardState.colorScale(id);
  } else {
    dashboardState.selectedIds.splice(currentIndex, 1);
    delete dashboardState.selectedColors[id];
  }
}

function createSelectControl(
  containerSelector,
  id,
  label,
  options,
  selectedValue,
  onChange,
) {
  let panel = d3.select(containerSelector).select(".dashboard-control-panel");
  if (panel.empty()) {
    panel = d3
      .select(containerSelector)
      .insert("div", ":first-child")
      .attr("class", "dashboard-control-panel");
  }

  const wrapper = panel
    .append("label")
    .attr("class", "dashboard-control-label")
    .attr("for", id);
  wrapper.append("span").text(label + ": ");

  const select = wrapper
    .append("select")
    .attr("id", id)
    .attr("class", "dashboard-select");
  select
    .selectAll("option")
    .data(options)
    .enter()
    .append("option")
    .attr("value", function (option) {
      return option;
    })
    .property("selected", function (option) {
      return option === selectedValue;
    })
    .text(function (option) {
      return option;
    });

  select.on("change", function () {
    onChange(this.value);
  });
}

function buildParallelDimensions() {
  const preferredColumns = SCRAP_COLUMNS.concat(
    ["Si", "Cu", "Mg", "Fe"],
    DEFAULT_PHASE_COLUMNS,
    DEFAULT_PROPERTY_COLUMN_HINTS,
  );
  const dimensions = preferredColumns.filter(function (column) {
    return dashboardState.numericColumns.includes(column);
  });

  if (dimensions.length >= 4) {
    return uniqueValues(dimensions).slice(0, 16);
  }

  return dashboardState.numericColumns.slice(0, 12);
}

function buildRadarDimensions() {
  const dimensions = DEFAULT_RADAR_COLUMN_HINTS.filter(function (column) {
    return dashboardState.numericColumns.includes(column);
  });

  if (dimensions.length >= 3) {
    return dimensions;
  }

  return dashboardState.numericColumns.slice(0, 6);
}

function sampleRows(rows, maxRows) {
  if (rows.length <= maxRows) {
    return rows;
  }

  // Deterministic uniform sampling avoids random visual changes between reloads.
  const step = rows.length / maxRows;
  return d3.range(maxRows).map(function (sampleIndex) {
    return rows[Math.floor(sampleIndex * step)];
  });
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  return Number(value);
}

function isPhaseFractionColumn(column) {
  return column.indexOf("Vf_") === 0;
}

function findFirstExistingColumn(candidates, existingColumns) {
  return candidates.find(function (candidate) {
    return existingColumns.includes(candidate);
  });
}

function getFiniteExtent(rows, column) {
  const extent = d3.extent(rows, function (row) {
    return Number.isFinite(row[column]) ? row[column] : undefined;
  });

  if (!Number.isFinite(extent[0]) || !Number.isFinite(extent[1])) {
    return [0, 1];
  }

  if (extent[0] === extent[1]) {
    return [extent[0] - 1, extent[1] + 1];
  }

  return extent;
}

function uniqueValues(values) {
  return Array.from(new Set(values));
}

function colorForColumnGroup(column) {
  if (SCRAP_COLUMNS.includes(column)) {
    return "#4c78a8";
  }
  if (COMPOSITION_COLUMNS.includes(column)) {
    return "#54a24b";
  }
  if (
    column.indexOf("Vf_") === 0 ||
    column.indexOf("T_") === 0 ||
    column.indexOf("delta_T") === 0
  ) {
    return "#e45756";
  }
  return "#f58518";
}

function shortenLabel(label, maxLength) {
  if (label.length <= maxLength) {
    return label;
  }

  return label.slice(0, maxLength - 1) + "…";
}

function showDashboardMessage(containerSelector, message) {
  d3.select(containerSelector)
    .append("div")
    .attr("class", "chart-message")
    .text(message);
}

function showChartMessage(chartGroup, message) {
  chartGroup
    .append("text")
    .attr("class", "chart-message-svg")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .text(message);
}

function showDashboardTooltip(event, row) {
  const tooltipSelection = getDashboardTooltip();
  const columnsToShow = uniqueValues(
    [
      dashboardState.xScatterColumn,
      dashboardState.yScatterColumn,
      dashboardState.sizeScatterColumn,
    ]
      .concat(dashboardState.radarDimensions)
      .filter(Boolean),
  );

  const html = columnsToShow
    .map(function (column) {
      return (
        "<strong>" + column + "</strong>: " + formatDashboardValue(row[column])
      );
    })
    .join("<br/>");

  tooltipSelection
    .style("opacity", 1)
    .html("<strong>" + row.__label + "</strong><br/>" + html);
  moveDashboardTooltip(event);
}

function moveDashboardTooltip(event) {
  getDashboardTooltip()
    .style("left", event.pageX + 12 + "px")
    .style("top", event.pageY + 12 + "px");
}

function hideDashboardTooltip() {
  getDashboardTooltip().style("opacity", 0);
}

function getDashboardTooltip() {
  if (typeof tooltip !== "undefined" && tooltip) {
    return tooltip;
  }

  let fallbackTooltip = d3.select("body").select(".tooltip");
  if (fallbackTooltip.empty()) {
    fallbackTooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);
  }

  return fallbackTooltip;
}

function formatDashboardValue(value) {
  if (Number.isFinite(value)) {
    return d3.format(".4~g")(value);
  }

  return value;
}

// Clear dashboard if changes (dataset) occur.
function clearDashboard() {
  ["#chart1", "#chart2", "#chart3", "#chart4"].forEach(function (selector) {
    d3.select(selector).selectAll("*").remove();
  });

  dashboardChart1Svg = null;
  dashboardChart2Svg = null;
  dashboardChart3Svg = null;
  dashboardChart4Svg = null;
  chart1 = null;
  chart2 = null;
  chart3 = null;
  chart4 = null;
}
