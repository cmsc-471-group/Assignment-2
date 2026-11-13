// WHITE HAT: Grouped Diverging Bar Chart
// Directly answers the core data question:
// "In which of five U.S. cities did gentrification change the racial makeup of neighborhoods the most, from 2000 to 2017?"
//
// Design choices for effortless readability:
// 1. Grouped horizontal diverging bars encode percentage point change (2017 - 2000) from a common zero baseline.
// 2. Clear contrast between Gentrified (True) and Eligible Non-Gentrified (False) pairs within each city.
// 3. Exact labels on every bar so viewers don't need to guess values.
// 4. City filter tabs allow viewing all cities or drilling into a specific city.
// 5. Shared, honest population-weighted calculations with sample sizes (n) prominently displayed.

(function () {
  const races = [
    { key: "black_alone",                      label: "Black",             color: "#c8453b" },
    { key: "white_alone",                      label: "White",             color: "#3a6fb0" },
    { key: "hispanic_or_latino",               label: "Hispanic / Latino", color: "#e08a1e" },
    { key: "asian_alone",                      label: "Asian",             color: "#3f9b5a" },
    { key: "native_alone",                     label: "Native American",   color: "#8a5bb0" },
    { key: "native_hawaiian_pacific_islander", label: "Pacific Islander",  color: "#8c6d4f" }
  ];

  // Primary 4 racial groups that represent >99% of population in these cities
  const displayRaces = races.slice(0, 4);

  const cities = [
    { key: "Washington",    label: "Washington, D.C." },
    { key: "Atlanta",       label: "Atlanta" },
    { key: "Oakland",       label: "Oakland" },
    { key: "Baltimore",     label: "Baltimore" },
    { key: "New York City", label: "New York" }
  ];

  let selectedCity = "all";  // "all" or specific city key
  let viewMode = "chg";      // "chg" (Change in pts), "17" (2017 Share), "00" (2000 Share)
  let cityData = {};         // cityData[city][gentStatus] = { n, pop00, pop17, shares: { race: { 00, 17, chg } } }
  let tractDots = [];        // individual tracts for drill-down view

  const holder = d3.select("#whitehat-chart")
    .classed("wh-holder", true)
    .style("position", "relative")
    .style("background", "#ffffff");

  // Build intuitive controls
  const controls = d3.select("#whitehat-controls");
  controls.html(`
    <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; width:100%; gap:12px; margin-bottom:8px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:0.5px;">Metric:</span>
        <div class="seg" id="wh-metric-seg" role="group" aria-label="Metric">
          <button data-mode="chg" class="on">Change (2017 − 2000)</button>
          <button data-mode="17">2017 Share</button>
          <button data-mode="00">2000 Share</button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:12px; font-weight:600; color:#555; text-transform:uppercase; letter-spacing:0.5px;">Filter City:</span>
        <div class="seg" id="wh-city-seg" role="group" aria-label="City Filter">
          <button data-city="all" class="on">All Cities</button>
          <button data-city="Washington">D.C.</button>
          <button data-city="Atlanta">Atlanta</button>
          <button data-city="Oakland">Oakland</button>
          <button data-city="Baltimore">Baltimore</button>
          <button data-city="New York City">New York</button>
        </div>
      </div>
    </div>
  `);

  const tip = d3.select("body").selectAll(".tooltip-wh").data([0]).join("div")
    .attr("class", "tooltip tooltip-wh")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "rgba(255, 255, 255, 0.98)")
    .style("border", "1px solid #999")
    .style("box-shadow", "0 3px 10px rgba(0,0,0,0.15)")
    .style("padding", "8px 12px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("line-height", "1.4")
    .style("z-index", 1000)
    .style("opacity", 0);

  function calculateAggregates(eligTracts) {
    cities.forEach(c => {
      cityData[c.key] = {
        gent: { n: 0, pop00: 0, pop17: 0, shares: {} },
        notGent: { n: 0, pop00: 0, pop17: 0, shares: {} }
      };

      [true, false].forEach(isGent => {
        const target = isGent ? cityData[c.key].gent : cityData[c.key].notGent;
        const sub = eligTracts.filter(d => d.city === c.key && d.gentrified === isGent);
        target.n = sub.length;
        target.pop00 = d3.sum(sub, d => +d.total_population_00 || 0);
        target.pop17 = d3.sum(sub, d => +d.total_population_17 || 0);

        races.forEach(r => {
          const count00 = d3.sum(sub, d => +d[r.key + "_00"] || 0);
          const count17 = d3.sum(sub, d => +d[r.key + "_17"] || 0);
          const s00 = target.pop00 > 0 ? (100 * count00 / target.pop00) : 0;
          const s17 = target.pop17 > 0 ? (100 * count17 / target.pop17) : 0;
          target.shares[r.key] = {
            s00: s00,
            s17: s17,
            chg: s17 - s00,
            count00: count00,
            count17: count17
          };
        });
      });
    });

    tractDots = [];
    eligTracts.forEach(d => {
      races.forEach(r => {
        const v00 = +d["pct_" + r.key + "_00"];
        const v17 = +d["pct_" + r.key + "_17"];
        if (!isNaN(v00) && !isNaN(v17)) {
          tractDots.push({
            city: d.city,
            gentrified: d.gentrified,
            race: r.key,
            s00: v00,
            s17: v17,
            chg: v17 - v00,
            name: d.name
          });
        }
      });
    });
  }

  function render() {
    holder.selectAll("*").remove();

    const activeCities = selectedCity === "all" ? cities : cities.filter(c => c.key === selectedCity);
    const isAll = selectedCity === "all";

    const width = 940;
    const rowHeight = viewMode === "chg" ? 116 : 108;
    const headerHeight = 110;
    const footerHeight = 65;
    const totalHeight = headerHeight + (activeCities.length * rowHeight) + footerHeight;

    const svg = holder.append("svg")
      .attr("viewBox", `0 0 ${width} ${totalHeight}`)
      .attr("width", "100%")
      .style("display", "block")
      .style("font-family", "'Helvetica Neue', Helvetica, Arial, sans-serif");

    // Header Title and Subtitle
    const titleG = svg.append("g").attr("transform", "translate(24, 28)");
    titleG.append("text")
      .attr("x", 0).attr("y", 0)
      .attr("font-size", "19px")
      .attr("font-weight", "700")
      .attr("fill", "#1a1a1a")
      .text(viewMode === "chg"
        ? "Shift in Neighborhood Racial Composition (2000 to 2017)"
        : (viewMode === "17" ? "Neighborhood Racial Composition in 2017" : "Neighborhood Racial Composition in 2000"));

    titleG.append("text")
      .attr("x", 0).attr("y", 22)
      .attr("font-size", "13px")
      .attr("fill", "#555")
      .text(viewMode === "chg"
        ? "Comparing lower-income neighborhoods that gentrified vs. similar eligible neighborhoods that did not. Values in percentage points."
        : "Comparing population-weighted racial shares (0% to 100%) between gentrified and non-gentrified neighborhoods.");

    // Legend
    const legendG = titleG.append("g").attr("transform", "translate(0, 46)");

    // Bar style legend
    legendG.append("rect").attr("x", 0).attr("y", -8).attr("width", 12).attr("height", 10).attr("fill", "#334155").attr("rx", 2);
    legendG.append("text").attr("x", 16).attr("y", 1).attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#1e293b").text("Gentrified (Solid)");

    legendG.append("rect").attr("x", 145).attr("y", -8).attr("width", 12).attr("height", 10)
      .attr("fill", "#f1f5f9").attr("stroke", "#94a3b8").attr("stroke-width", 1.2).attr("rx", 2);
    legendG.append("text").attr("x", 161).attr("y", 1).attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#475569").text("Did Not Gentrify (Light)");

    // Divider
    legendG.append("line").attr("x1", 335).attr("x2", 335).attr("y1", -9).attr("y2", 5).attr("stroke", "#cbd5e1");

    // Racial group color dots
    let rx = 355;
    displayRaces.forEach(r => {
      legendG.append("circle").attr("cx", rx).attr("cy", -2).attr("r", 5).attr("fill", r.color);
      legendG.append("text").attr("x", rx + 9).attr("y", 2).attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#334155").text(r.label);
      rx += 18 + r.label.length * 7.5;
    });

    const margin = { left: 155, right: 85 };
    const chartW = width - margin.left - margin.right;

    // Scales
    let xScale;
    if (viewMode === "chg") {
      // Symmetrical domain for balanced left/right diverging bars
      xScale = d3.scaleLinear().domain([-30, 30]).range([0, chartW]);
    } else {
      xScale = d3.scaleLinear().domain([0, 100]).range([0, chartW]);
    }

    // Gridlines, Zero Axis, and Top & Bottom Labels
    const axisG = svg.append("g").attr("transform", `translate(${margin.left}, ${headerHeight - 12})`);
    const ticks = viewMode === "chg" ? [-30, -20, -10, 0, 10, 20, 30] : [0, 20, 40, 60, 80, 100];
    const gridBottom = activeCities.length * rowHeight;

    // Bottom horizontal baseline rule
    axisG.append("line")
      .attr("x1", 0).attr("x2", chartW)
      .attr("y1", gridBottom).attr("y2", gridBottom)
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 1);

    ticks.forEach(t => {
      const tx = xScale(t);

      // Vertical gridline
      axisG.append("line")
        .attr("x1", tx).attr("x2", tx)
        .attr("y1", 0).attr("y2", gridBottom)
        .attr("stroke", t === 0 ? "#444" : "#e6e6e6")
        .attr("stroke-width", t === 0 ? 1.8 : 1)
        .attr("stroke-dasharray", t === 0 ? "none" : (viewMode === "chg" ? "3,3" : "none"));

      // Top label
      axisG.append("text")
        .attr("x", tx).attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", t === 0 ? "700" : "500")
        .attr("fill", t === 0 ? "#111" : "#777")
        .text(viewMode === "chg" ? (t > 0 ? `+${t} pts` : (t === 0 ? "0 (No change)" : `${t} pts`)) : `${t}%`);

      // Bottom label
      axisG.append("text")
        .attr("x", tx).attr("y", gridBottom + 16)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", t === 0 ? "700" : "500")
        .attr("fill", t === 0 ? "#111" : "#777")
        .text(viewMode === "chg" ? (t > 0 ? `+${t} pts` : (t === 0 ? "0" : `${t} pts`)) : `${t}%`);
    });

    // Draw City Sections
    activeCities.forEach((cityObj, cIdx) => {
      const cG = svg.append("g")
        .attr("transform", `translate(0, ${headerHeight + cIdx * rowHeight})`);

      const gData = cityData[cityObj.key].gent;
      const ngData = cityData[cityObj.key].notGent;

      // Subtle row background separator
      if (cIdx > 0) {
        cG.append("line")
          .attr("x1", 16).attr("x2", width - 16)
          .attr("y1", 0).attr("y2", 0)
          .attr("stroke", "#e9ecef")
          .attr("stroke-width", 1);
      }

      // City Label & Clean Metadata Card
      const labelG = cG.append("g").attr("transform", `translate(16, 14)`);

      // Soft container card for the city
      labelG.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", 126).attr("height", rowHeight - 24)
        .attr("fill", "#f8fafc")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("rx", 6);

      // City title
      labelG.append("text")
        .attr("x", 12).attr("y", 22)
        .attr("font-size", "13.5px")
        .attr("font-weight", "700")
        .attr("fill", "#0f172a")
        .text(cityObj.label);

      // Gentrified status row with indicator icon
      const gRow = labelG.append("g").attr("transform", "translate(12, 44)");
      gRow.append("rect")
        .attr("x", 0).attr("y", -8)
        .attr("width", 8).attr("height", 8)
        .attr("fill", "#334155")
        .attr("rx", 1.5);
      gRow.append("text")
        .attr("x", 13).attr("y", 0)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", "#334155")
        .text(`Gentrified: ${gData.n}`);

      // Not Gentrified status row with indicator icon
      const ngRow = labelG.append("g").attr("transform", "translate(12, 64)");
      ngRow.append("rect")
        .attr("x", 0).attr("y", -8)
        .attr("width", 8).attr("height", 8)
        .attr("fill", "#f1f5f9")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 1.2)
        .attr("rx", 1.5);
      ngRow.append("text")
        .attr("x", 13).attr("y", 0)
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .attr("fill", "#64748b")
        .text(`Did Not: ${ngData.n}`);

      // Plot bars for each race
      const barsG = cG.append("g").attr("transform", `translate(${margin.left}, 12)`);
      const numRaces = displayRaces.length;
      const raceGroupHeight = (rowHeight - 20) / numRaces;
      const barH = 8;
      const barSpacing = 2;

      displayRaces.forEach((r, rIdx) => {
        const ry = rIdx * raceGroupHeight;
        const gVal = viewMode === "chg" ? gData.shares[r.key].chg : (viewMode === "17" ? gData.shares[r.key].s17 : gData.shares[r.key].s00);
        const ngVal = viewMode === "chg" ? ngData.shares[r.key].chg : (viewMode === "17" ? ngData.shares[r.key].s17 : ngData.shares[r.key].s00);

        // Helper function for bar coordinates
        const getBarCoords = (val) => {
          if (viewMode === "chg") {
            const x0 = xScale(Math.min(0, val));
            const w = Math.abs(xScale(val) - xScale(0));
            return { x: x0, w: Math.max(1.5, w) };
          } else {
            return { x: xScale(0), w: Math.max(1.5, xScale(val)) };
          }
        };

        // 1. Gentrified Bar (Top)
        const gCoords = getBarCoords(gVal);
        const gBar = barsG.append("rect")
          .attr("x", gCoords.x)
          .attr("y", ry)
          .attr("width", gCoords.w)
          .attr("height", barH)
          .attr("fill", r.color)
          .attr("rx", 2)
          .style("cursor", "pointer")
          .style("transition", "opacity 0.2s");

        // 2. Non-Gentrified Bar (Bottom)
        const ngCoords = getBarCoords(ngVal);
        const ngBar = barsG.append("rect")
          .attr("x", ngCoords.x)
          .attr("y", ry + barH + barSpacing)
          .attr("width", ngCoords.w)
          .attr("height", barH)
          .attr("fill", r.color)
          .attr("opacity", 0.35)
          .attr("stroke", r.color)
          .attr("stroke-width", 1)
          .attr("rx", 2)
          .style("cursor", "pointer")
          .style("transition", "opacity 0.2s");

        // Value text labels for Gentrified (always display exact value)
        const gTextX = viewMode === "chg"
          ? (gVal >= 0 ? xScale(gVal) + 5 : xScale(gVal) - 5)
          : xScale(gVal) + 5;
        const gAnchor = viewMode === "chg" ? (gVal >= 0 ? "start" : "end") : "start";

        barsG.append("text")
          .attr("x", gTextX)
          .attr("y", ry + barH - 1)
          .attr("text-anchor", gAnchor)
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .attr("fill", "#1e293b")
          .text(viewMode === "chg" ? (gVal > 0 ? `+${gVal.toFixed(1)}` : `${gVal.toFixed(1)}`) : `${gVal.toFixed(1)}%`);

        // Value text labels for Not Gentrified (always display exact value)
        const ngTextX = viewMode === "chg"
          ? (ngVal >= 0 ? xScale(ngVal) + 5 : xScale(ngVal) - 5)
          : xScale(ngVal) + 5;
        const ngAnchor = viewMode === "chg" ? (ngVal >= 0 ? "start" : "end") : "start";

        barsG.append("text")
          .attr("x", ngTextX)
          .attr("y", ry + barH * 2 + barSpacing - 1)
          .attr("text-anchor", ngAnchor)
          .attr("font-size", "10px")
          .attr("font-weight", "500")
          .attr("fill", "#64748b")
          .text(viewMode === "chg" ? (ngVal > 0 ? `+${ngVal.toFixed(1)}` : `${ngVal.toFixed(1)}`) : `${ngVal.toFixed(1)}%`);

        // Interactive Tooltip handlers
        const attachTooltip = (el, isGentrified) => {
          el.on("mousemove", (event) => {
            const dataObj = isGentrified ? gData : ngData;
            const statusLabel = isGentrified ? "Gentrified Neighborhoods" : "Eligible, Did Not Gentrify";
            const stats = dataObj.shares[r.key];
            const chgStr = stats.chg > 0 ? `+${stats.chg.toFixed(1)} pts` : `${stats.chg.toFixed(1)} pts`;

            tip.html(`
              <div style="font-weight:700; color:${r.color}; font-size:13px; margin-bottom:4px;">
                ${cityObj.label} · ${r.label}
              </div>
              <div style="color:#333; margin-bottom:6px;">
                <b>${statusLabel}</b> (n = ${dataObj.n} neighborhoods)
              </div>
              <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
                <tr><td style="color:#666; padding-right:12px;">2000 Share:</td><td><b>${stats.s00.toFixed(1)}%</b> (${d3.format(",")(Math.round(stats.count00))} residents)</td></tr>
                <tr><td style="color:#666; padding-right:12px;">2017 Share:</td><td><b>${stats.s17.toFixed(1)}%</b> (${d3.format(",")(Math.round(stats.count17))} residents)</td></tr>
                <tr style="border-top:1px solid #ddd;"><td style="color:#111; padding-top:3px;"><b>Net Change:</b></td><td style="padding-top:3px; font-weight:700; color:${stats.chg < 0 ? '#c8453b' : '#2b6cb0'}">${chgStr}</td></tr>
              </table>
            `)
              .style("left", (event.pageX + 14) + "px")
              .style("top", (event.pageY - 28) + "px")
              .style("opacity", 1);

            d3.select(event.currentTarget).attr("stroke", "#111").attr("stroke-width", 1.5);
          })
          .on("mouseout", (event) => {
            tip.style("opacity", 0);
            d3.select(event.currentTarget).attr("stroke", isGentrified ? "none" : r.color).attr("stroke-width", isGentrified ? 0 : 1);
          });
        };

        attachTooltip(gBar, true);
        attachTooltip(ngBar, false);
      });
    });

    // Footnote
    const footG = svg.append("g").attr("transform", `translate(24, ${totalHeight - 20})`);
    footG.append("text")
      .attr("x", 0).attr("y", 0)
      .attr("font-size", "11px")
      .attr("fill", "#777")
      .text("Source: BuzzFeed News Census analysis (2000 Census & 2013–2017 ACS). Averages are population-weighted across 882 eligible lower-income neighborhoods.");
  }

  // Load and initialize
  tractsPromise.then(data => {
    const elig = data.filter(d => d.eligible_for_gentrification &&
      races.every(r => ["00", "17"].every(y => d["pct_" + r.key + "_" + y] !== "" && !isNaN(+d["pct_" + r.key + "_" + y]))));

    calculateAggregates(elig);
    render();

    // Event listeners for metric toggle
    d3.selectAll("#wh-metric-seg button").on("click", function () {
      d3.selectAll("#wh-metric-seg button").classed("on", false);
      d3.select(this).classed("on", true);
      viewMode = this.dataset.mode;
      render();
    });

    // Event listeners for city filter
    d3.selectAll("#wh-city-seg button").on("click", function () {
      d3.selectAll("#wh-city-seg button").classed("on", false);
      d3.select(this).classed("on", true);
      selectedCity = this.dataset.city;
      render();
    });
  });

})();