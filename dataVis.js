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

// scatterplot axes
let xAxis, yAxis, xAxisLabel, yAxisLabel;
// radar chart axes
let radarAxes, radarAxesAngle;

let dimensions = [
  "dimension 1",
  "dimension 2",
  "dimension 3",
  "dimension 4",
  "dimension 5",
  "dimension 6",
];
//*HINT: the first dimension is often a label; you can simply remove the first dimension with
// dimensions.splice(0, 1);

// the visual channels we can use for the scatterplot
let channels = ["scatterX", "scatterY", "size"];

// size of the plots
let margin, width, height, radius;
// svg containers
let scatter, radar, dataTable;

// Add additional variables
let dataset = [];
let xScale, yScale, sizeScale;
let radarScales = {};
let labelDimension = null;
let selectedItems = [];
let colorScale = d3.scaleOrdinal(d3.schemeTableau10);
let selectedItemColors = {};
let tooltip;
const ANIMATION_DURATION = 500;
const LOADING_INDICATOR_DELAY_MS = 180;

function init() {
  // define size of plots
  margin = { top: 20, right: 20, bottom: 20, left: 50 };
  width = 600;
  height = 500;
  radius = width / 2;

  // Start at default tab
  document.getElementById("defaultOpen").click();

  // data table
  dataTable = d3.select("#dataTable");
  tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  // scatterplot SVG container and axes
  scatter = d3
    .select("#sp")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g");

  // radar chart SVG container and axes
  radar = d3
    .select("#radar")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  // read and parse input file
  let fileInput = document.getElementById("upload"),
    readFile = function () {
      // Keep current content visible while loading, and only show indicator
      // for loads that are slow enough to be noticeable.
      let loadingIndicatorTimer = setTimeout(function () {
        showLoadingIndicator();
      }, LOADING_INDICATOR_DELAY_MS);

      let reader = new FileReader();
      reader.onloadend = function () {
        clearTimeout(loadingIndicatorTimer);
        loadingIndicatorTimer = null;

        console.log("data loaded: ");
        console.log(reader.result);

        // Parse CSV data
        let parsedData = d3.csvParse(reader.result);
        console.log("Parsed data: ", parsedData);

        // Replace old content only after the new file is ready.
        clear();

        // Call init functions with the parsed data
        initVis(parsedData);
        CreateDataTable(parsedData);
        // TODO: possible place to call the dashboard file for Part 2
        initDashboard(null);

        // Hide loading indicator
        hideLoadingIndicator();
      };
      reader.readAsText(fileInput.files[0]);
    };
  fileInput.addEventListener("change", readFile);
}

function initVis(_data) {
  // TODO: parse dimensions (i.e., attributes) from input file
  console.log("Data: ", _data);
  if (!_data || _data.length === 0) {
    return;
  }

  // Parse numeric dimensions dynamically from the uploaded file.
  const allColumns = Object.keys(_data[0]);
  labelDimension = allColumns.find((column) =>
    _data.some((row) => Number.isNaN(Number(row[column]))),
  );
  dimensions = allColumns.filter(
    (column) => _data.every((row) => Number.isFinite(Number(row[column]))),
  );

  // Keep only valid numeric dimensions and cast values once.
  dataset = _data.map(function (row, index) {
    const parsedRow = { ...row, __id: index };
    dimensions.forEach(function (dimension) {
      parsedRow[dimension] = Number(row[dimension]);
    });
    parsedRow.__label = labelDimension ? row[labelDimension] : "Item " + (index + 1);
    return parsedRow;
  });
  selectedItems = [];
  selectedItemColors = {};

  // y scalings for scatterplot
  yScale = d3
    .scaleLinear()
    .range([height - margin.bottom - margin.top, margin.top]);

  // x scalings for scatter plot
  xScale = d3
    .scaleLinear()
    .range([margin.left, width - margin.left - margin.right]);

  // radius scalings for radar chart
  // 4, 14
  sizeScale = d3.scaleSqrt().range([4, 14]);
  radarScales = {};
  dimensions.forEach(function (dimension) {
    radarScales[dimension] = d3
      .scaleLinear()
      .domain(d3.extent(dataset, function (d) {
        return d[dimension];
      }))
      .range([0, radius * 0.75]);
  });

  // scatterplot axes
  yAxis = scatter
    .append("g")
    .attr("class", "axis")
    .attr("transform", "translate(" + margin.left + ")")
    .call(d3.axisLeft(yScale));

  yAxisLabel = yAxis
    .append("text")
    .style("text-anchor", "middle")
    .attr("y", margin.top / 2)
    .text("x");

  xAxis = scatter
    .append("g")
    .attr("class", "axis")
    .attr(
      "transform",
      "translate(0, " + (height - margin.bottom - margin.top) + ")",
    )
    .call(d3.axisBottom(xScale));

  xAxisLabel = xAxis
    .append("text")
    .style("text-anchor", "middle")
    .attr("x", width - margin.right)
    .text("y");

  // radar chart axes
  radarAxesAngle = (Math.PI * 2) / dimensions.length;
  let axisRadius = d3.scaleLinear().range([0, radius]);
  let maxAxisRadius = 0.75,
    textRadius = 0.8;
  gridRadius = 0.1;

  // radar axes
  radarAxes = radar
    .selectAll(".axis")
    .data(dimensions)
    .enter()
    .append("g")
    .attr("class", "axis");

  radarAxes
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", function (d, i) {
      return radarX(axisRadius(maxAxisRadius), i);
    })
    .attr("y2", function (d, i) {
      return radarY(axisRadius(maxAxisRadius), i);
    })
    .attr("class", "line")
    .style("stroke", "black");

  // TODO: render grid lines in gray

  radar
    .selectAll(".axisLabel")
    .data(dimensions)
    .enter()
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("x", function (d, i) {
      return radarX(axisRadius(textRadius), i);
    })
    .attr("y", function (d, i) {
      return radarY(axisRadius(textRadius), i);
    })
    .text(function (dimension) {
      return dimension;
    });

  // init menu for the visual channels
  channels.forEach(function (c) {
    initMenu(c, dimensions);
  });

  // refresh all select menus
  channels.forEach(function (c) {
    refreshMenu(c);
  });

  renderScatterplot();
  renderRadarChart();
}

// clear visualizations before loading a new file
function clear() {
  scatter.selectAll("*").remove();
  radar.selectAll("*").remove();
  dataTable.selectAll("*").remove();
}

// Show loading indicator
function showLoadingIndicator() {
  const indicator = document.getElementById("loadingIndicator");
  if (indicator) {
    indicator.classList.remove("hidden");
  }
}

// Hide loading indicator
function hideLoadingIndicator() {
  const indicator = document.getElementById("loadingIndicator");
  if (indicator) {
    indicator.classList.add("hidden");
  }
}

//Create Table
function CreateDataTable(_data) {
  // create table and add class
  let table = dataTable
    .append("table")
    .attr("class", "data-table")
    .style("border-collapse", "collapse")
    .style("border", "2px solid black");

  // add headers, row & columns
  if (_data && _data.length > 0) {
    // get all keys from the first data object
    let headers = Object.keys(_data[0]);

    // append header row
    let thead = table.append("thead");
    let headerRow = thead.append("tr");
    headerRow
      .selectAll("th")
      .data(headers)
      .enter()
      .append("th")
      .text((d) => d)
      .style("border", "1px solid black")
      .style("padding", "8px")
      .style("background-color", "#e4ffff")
      .style("font-weight", "bold");

    // append data rows
    let tbody = table.append("tbody");
    tbody
      .selectAll("tr")
      .data(_data)
      .enter()
      .append("tr")
      .selectAll("td")
      .data((d) => headers.map((key) => d[key]))
      .enter()
      .append("td")
      .text((d) => d)
      .style("border", "1px solid black")
      .style("padding", "8px")
      // add mouseover event with cyan color
      .on("mouseover", function () {
        d3.select(this)
          .style("background-color", "#98ffff")

      })
      .on("mouseout", function () {
        d3.select(this).style("background-color", "");
      });
  }
}
function renderScatterplot() {
  if (dataset.length === 0 || dimensions.length === 0) {
    return;
  }

  const xDimension = readMenu("scatterX");
  const yDimension = readMenu("scatterY");
  const sizeDimension = readMenu("size");
  if (!xDimension || !yDimension || !sizeDimension) {
    return;
  }

  // Update scales and axis labels based on the selected dimensions.
  xScale.domain(d3.extent(dataset, function (d) {
    return d[xDimension];
  })).nice();
  yScale.domain(d3.extent(dataset, function (d) {
    return d[yDimension];
  })).nice();
  sizeScale.domain(d3.extent(dataset, function (d) {
    return d[sizeDimension];
  }));

  const transition = d3
    .transition()
    .duration(ANIMATION_DURATION)
    .ease(d3.easeCubicInOut);

  xAxis.transition(transition).call(d3.axisBottom(xScale));
  yAxis.transition(transition).call(d3.axisLeft(yScale));
  xAxisLabel.transition(transition).text(xDimension);
  yAxisLabel.transition(transition).text(yDimension);

  // Render circles and keep visual feedback for selected items.
  const grayShades = ["#111111", "#2b2b2b", "#454545", "#5f5f5f", "#797979", "#939393"];
  const dots = scatter
    .selectAll(".dot")
    .data(dataset, function (d) {
      return d.__id;
    })
    .join(
      function (enter) {
        return enter
          .append("circle")
          .attr("class", "dot")
          .attr("cx", function (d) {
            return xScale(d[xDimension]);
          })
          .attr("cy", function (d) {
            return yScale(d[yDimension]);
          })
          .attr("r", 0)
          .attr("opacity", 0)
          .call(function (selection) {
            selection
              .transition(transition)
              .attr("r", function (d) {
                return sizeScale(d[sizeDimension]);
              })
              .attr("opacity", 0.7);
          });
      },
      function (update) {
        return update.call(function (selection) {
          selection
            .transition(transition)
            .attr("cx", function (d) {
              return xScale(d[xDimension]);
            })
            .attr("cy", function (d) {
              return yScale(d[yDimension]);
            })
            .attr("r", function (d) {
              return sizeScale(d[sizeDimension]);
            })
            .attr("opacity", 0.7);
        });
      },
      function (exit) {
        return exit
          .transition(transition)
          .attr("r", 0)
          .attr("opacity", 0)
          .remove();
      },
    )
    .attr("fill", function (d) {
      if (selectedItems.includes(d.__id)) {
        return selectedItemColors[d.__id];
      }

      // Keep unselected marks in grayscale to focus selected items.
      return grayShades[d.__id % grayShades.length];
    })
    .attr("stroke-width", function (d) {
      return selectedItems.includes(d.__id) ? 2 : 0;
    })
    .attr("stroke", "#222")
    .on("click", function (event, d) {
      const currentIndex = selectedItems.indexOf(d.__id);
      if (currentIndex === -1) {
        selectedItems.push(d.__id);
        selectedItemColors[d.__id] = colorScale(d.__id);
      } else {
        selectedItems.splice(currentIndex, 1);
        delete selectedItemColors[d.__id];
      }

      renderScatterplot();
      renderRadarChart();
    })
    .on("mouseover", function (event, d) {
      const tooltipHtml = Object.keys(d)
        .filter(function (key) {
          return !key.startsWith("__");
        })
        .map(function (key) {
          return "<strong>" + key + "</strong>: " + d[key];
        })
        .join("<br/>");

      tooltip
        .style("opacity", 1)
        .html(tooltipHtml)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY + 12 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    });

  dots
    .selectAll("title")
    .data(function (d) {
      return [d.__label];
    })
    .join("title")
    .text(function (d) {
      return d;
    });
}

function renderRadarChart() {
  if (dataset.length === 0 || dimensions.length === 0) {
    return;
  }

  // Show only explicitly selected items in legend and radar chart.
  const itemIds = selectedItems;
  const itemsToDraw = dataset.filter(function (d) {
    return itemIds.includes(d.__id);
  });

  // Render a simple interactive legend for the currently drawn lines.
  const legend = d3.select("#legend");
  legend.html("<b>Legend:</b><br />");
  const legendEntries = legend
    .selectAll(".legend-entry")
    .data(itemsToDraw, function (d) {
      return d.__id;
    })
    .join("div")
    .attr("class", "legend-entry");

  legendEntries
    .append("span")
    .attr("class", "color-circle")
    .style("background-color", function (d) {
      return selectedItemColors[d.__id];
    });

  legendEntries
    .append("span")
    .style("margin-left", "6px")
    .text(function (d) {
      return d.__label;
    });

  legendEntries
    .append("span")
    .attr("class", "close")
    .text("x")
    .on("click", function (event, d) {
      selectedItems = selectedItems.filter(function (id) {
        return id !== d.__id;
      });
      renderScatterplot();
      renderRadarChart();
    });

  // Build one radar polyline per visible item in a unique color.
  const lineGenerator = d3
    .lineRadial()
    .radius(function (entry) {
      return radarScales[entry.dimension](entry.value);
    })
    .angle(function (entry) {
      return radarAngle(entry.index);
    })
    .curve(d3.curveLinearClosed);

  const radarData = itemsToDraw.map(function (item) {
    return {
      id: item.__id,
      label: item.__label,
      values: dimensions.map(function (dimension, index) {
        return { dimension: dimension, index: index, value: item[dimension] };
      }),
    };
  });

  radar
    .selectAll(".radar-shape")
    .data(radarData, function (d) {
      return d.id;
    })
    .join("path")
    .attr("class", "radar-shape")
    .attr("fill", "none")
    .attr("stroke-width", 2)
    .attr("opacity", 0.9)
    .attr("stroke", function (d) {
      return selectedItemColors[d.id];
    })
    .attr("d", function (d) {
      return lineGenerator(d.values);
    });
}

function radarX(radius, index) {
  return radius * Math.cos(radarAngle(index));
}

function radarY(radius, index) {
  return radius * Math.sin(radarAngle(index));
}

function radarAngle(index) {
  return radarAxesAngle * index - Math.PI / 2;
}

// init scatterplot select menu
function initMenu(id, entries) {
  $("select#" + id).empty();

  entries.forEach(function (d) {
    $("select#" + id).append("<option>" + d + "</option>");
  });

  $("#" + id).selectmenu({
    select: function () {
      renderScatterplot();
    },
  });
}

// refresh menu after reloading data
function refreshMenu(id) {
  $("#" + id).selectmenu("refresh");
}

// read current scatterplot parameters
function readMenu(id) {
  return $("#" + id).val();
}

// switches and displays the tabs
function openPage(pageName, elmnt, color) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
  }
  document.getElementById(pageName).style.display = "block";
  elmnt.style.backgroundColor = color;
}
