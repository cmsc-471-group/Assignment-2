// WHITE HAT: same layout as the black hat, but corrected
// one line per race, each city split into Gentrified True / False
// axis/scale setup based on syntagmatic's "Exoplanets II" block
// https://gist.github.com/syntagmatic/482706e0638c67836d94b20f0cb37122
//
// fixes vs the black hat:
//  - every axis shares ONE scale (0-100%), so heights can be compared across axes
//  - only tracts that were ELIGIBLE to gentrify (lower income in 2000), so True vs False is a fair match
//  - shares are population-weighted (people, not tracts)
//  - a "Change" view shows 2017 minus 2000 directly, and the 2017 view keeps 2000 as a dashed line
//  - every tract is a dot at its real value, nothing gets cut off
//  - neutral title, sample sizes on every axis

(function () {

  const races = [
    { key: "black_alone",                      label: "Black",             color: "#c8453b" },
    { key: "white_alone",                      label: "White",             color: "#3a6fb0" },
    { key: "hispanic_or_latino",               label: "Hispanic / Latino", color: "#e08a1e" },
    { key: "asian_alone",                      label: "Asian",             color: "#3f9b5a" },
    { key: "native_alone",                     label: "Native American",   color: "#8a5bb0" },
    { key: "native_hawaiian_pacific_islander", label: "Pacific Islander",  color: "#8c6d4f" }
  ];

  const cities = [
    { key: "New York City", label: "New York" },
    { key: "Washington",    label: "D.C." },
    { key: "Baltimore",     label: "Baltimore" },
    { key: "Atlanta",       label: "Atlanta" },
    { key: "Oakland",       label: "Oakland" }
  ];

  const axesDef = cities.flatMap(c => [true, false].map(gv => ({
    key: c.key + "|" + gv,
    cityKey: c.key,
    city: c.label,
    gent: gv,
    label: gv ? "True" : "False"
  })));

  const W = 900, H = 580;
  const margin = { top: 192, right: 30, bottom: 64, left: 92 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  let mode = "17";          // "00", "17" or "chg"
  let vals = {};            // vals[race][axis][mode]
  let nByAxis = {};
  let dots = [];            // one per tract per race
  let hoverKey = null;
  let chgDomain = [-70, 40];

  const holder = d3.select("#whitehat-chart")
    .classed("pc-holder", true)
    .style("aspect-ratio", W + " / " + H);

  d3.select("#whitehat-controls").html(`
    <div class="seg" role="group" aria-label="Year">
      <button data-mode="00">2000</button>
      <button data-mode="17">2017</button>
      <button data-mode="chg">Change (2017 − 2000)</button>
    </div>
    <span class="pc-count">Hover a line for exact values</span>`);

  const dpr = window.devicePixelRatio || 1;
  const canvas = holder.append("canvas").attr("width", W * dpr).attr("height", H * dpr).node();
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const svg = holder.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tip = d3.select("body").append("div").attr("class", "tooltip");

  const x = d3.scalePoint().domain(axesDef.map(a => a.key)).range([0, innerW]).padding(0.15);

  // one shared scale for every axis
  const yLevel = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);
  let yChg = d3.scaleLinear().domain(chgDomain).range([innerH, 0]);
  const yNow = () => mode === "chg" ? yChg : yLevel;

  const lineGen = d3.line();
  const pts = (r, m) => axesDef.map(a => [x(a.key), (m === "chg" ? yChg : yLevel)(vals[r.key][a.key][m])]);

  const gridG = g.append("g").attr("class", "wh-grid");
  const yAxisG = g.append("g").attr("class", "wh-yaxis");
  const yLabel = g.append("text").attr("class", "pc-sublabel")
    .attr("transform", "rotate(-90)").attr("x", -innerH / 2).attr("y", -62).attr("text-anchor", "middle");
  const axisLinesG = g.append("g");
  const ghostG = g.append("g");
  const linesG = g.append("g");
  const dotsG = g.append("g");

  function drawGridAndAxis(dur) {
    const sc = yNow();
    const ticks = mode === "chg" ? sc.ticks(8) : d3.range(0, 101, 10);

    gridG.selectAll("line").data(ticks, d => mode + d).join(
      enter => enter.append("line").attr("x1", -6).attr("x2", innerW)
        .attr("y1", d => sc(d)).attr("y2", d => sc(d)).attr("opacity", 0),
      update => update,
      exit => exit.remove()
    ).transition().duration(dur)
      .attr("y1", d => sc(d)).attr("y2", d => sc(d))
      .attr("opacity", 1)
      .attr("stroke", d => d === 0 && mode === "chg" ? "#888" : "#ececec")
      .attr("stroke-width", d => d === 0 && mode === "chg" ? 1.5 : 1);

    yAxisG.transition().duration(dur)
      .call(d3.axisLeft(sc).tickValues(ticks).tickSize(0).tickPadding(8)
        .tickFormat(v => mode === "chg" ? (v > 0 ? "+" : "") + v + " pts" : v + "%"))
      .attr("transform", "translate(-6,0)");
    yAxisG.select(".domain").remove();

    yLabel.text(mode === "chg" ? "Change in share of residents (percentage points)" : "Share of residents");
  }

  function render(animate) {
    const dur = animate ? 800 : 0;
    drawGridAndAxis(dur);

    // plain vertical axis lines (the scale is shared, so no ticks on each one)
    axisLinesG.selectAll("line").data(axesDef, a => a.key).join("line")
      .attr("x1", a => x(a.key)).attr("x2", a => x(a.key))
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#777");

    // 2000 as a dashed ghost when looking at 2017
    ghostG.selectAll("path").data(races.slice().reverse(), r => r.key).join("path")
      .attr("fill", "none")
      .attr("stroke", r => r.color)
      .attr("stroke-width", 1.6)
      .attr("stroke-dasharray", "4,3")
      .attr("d", r => lineGen(pts(r, "00")))
      .transition().duration(dur)
      .attr("opacity", mode === "17" ? 0.55 : 0);

    const ln = linesG.selectAll(".race-line").data(races.slice().reverse(), r => r.key);
    ln.enter().append("path")
        .attr("class", "race-line")
        .attr("fill", "none")
        .attr("stroke", r => r.color)
        .attr("stroke-width", 3)
        .attr("stroke-linejoin", "round")
        .attr("d", r => lineGen(pts(r, mode)))
        .on("mouseover", (e, r) => highlight(r.key))
        .on("mousemove", (e, r) => showTip(e, r))
        .on("mouseout", () => { highlight(null); tip.style("opacity", 0); })
      .merge(ln)
        .transition().duration(dur)
        .attr("d", r => lineGen(pts(r, mode)));

    const dd = races.flatMap(r => axesDef.map(a => ({ r: r, a: a })));
    const dts = dotsG.selectAll(".race-dot").data(dd, d => d.r.key + "|" + d.a.key);
    dts.enter().append("circle")
        .attr("class", "race-dot")
        .attr("r", 4)
        .attr("fill", d => d.r.color)
        .attr("stroke", "white").attr("stroke-width", 1.2)
        .attr("cx", d => x(d.a.key))
        .attr("cy", d => yNow()(vals[d.r.key][d.a.key][mode]))
        .on("mouseover", (e, d) => highlight(d.r.key))
        .on("mousemove", (e, d) => showTip(e, d.r))
        .on("mouseout", () => { highlight(null); tip.style("opacity", 0); })
      .merge(dts)
        .transition().duration(dur)
        .attr("cy", d => yNow()(vals[d.r.key][d.a.key][mode]));

    d3.selectAll("#whitehat-controls .seg button").classed("on", function () { return this.dataset.mode === mode; });
  }

  // ---- every tract as a faint dot at its real value ----
  function dotY(dt, m) {
    return (m === "chg" ? yChg : yLevel)(dt.v[m]) + margin.top;
  }

  function drawTractDots(yFn) {
    ctx.clearRect(0, 0, W, H);
    races.forEach(r => {
      if (hoverKey && hoverKey !== r.key) return;
      ctx.fillStyle = r.color;
      d3.groups(dots.filter(dt => dt.race === r.key), dt => dt.axis).forEach(([ax, rows]) => {
        const a = Math.max(0.05, Math.min(0.35, 3 / Math.sqrt(rows.length)));
        ctx.globalAlpha = hoverKey ? Math.min(0.7, a * 2) : a;
        rows.forEach(dt => {
          ctx.beginPath();
          ctx.arc(x(dt.axis) + margin.left + dt.jit, yFn(dt), 1.6, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    });
    ctx.globalAlpha = 1;
  }

  function setMode(m) {
    if (m === mode) return;
    const old = mode;
    mode = m;
    render(true);
    const tm = d3.timer(el => {
      const k = d3.easeCubicInOut(Math.min(1, el / 800));
      drawTractDots(dt => { const a = dotY(dt, old), b = dotY(dt, mode); return a + (b - a) * k; });
      if (k >= 1) tm.stop();
    });
  }

  function highlight(key) {
    hoverKey = key;
    drawTractDots(dt => dotY(dt, mode));
    linesG.selectAll(".race-line").attr("opacity", r => key == null || r.key === key ? 1 : 0.12);
    dotsG.selectAll(".race-dot").attr("opacity", d => key == null || d.r.key === key ? 1 : 0.12);
    ghostG.selectAll("path").attr("visibility", r => key == null || r.key === key ? "visible" : "hidden");
  }

  function fmt(v) { return (mode === "chg" && v > 0 ? "+" : "") + v.toFixed(1) + (mode === "chg" ? " pts" : "%"); }

  function showTip(e, r) {
    const rows = cities.map(c => {
      const t = vals[r.key][c.key + "|true"][mode], f = vals[r.key][c.key + "|false"][mode];
      return `<tr><td>${c.label}</td><td><b>${fmt(t)}</b></td><td>${fmt(f)}</td></tr>`;
    }).join("");
    const head = mode === "chg" ? "Change, 2000 → 2017" : (mode === "00" ? "2000" : "2017");
    tip.html(`<b style="color:${r.color}">${r.label}</b> · ${head}
              <table class="tip-tbl"><tr><th></th><th>Gentrified</th><th>Not</th></tr>${rows}</table>`)
      .style("left", (e.pageX + 14) + "px")
      .style("top", (e.pageY - 20) + "px")
      .style("opacity", 1);
  }

  function drawHeaders() {
    const grp = g.append("g");
    cities.forEach((c, i) => {
      const x1 = x(c.key + "|true"), x2 = x(c.key + "|false");
      grp.append("text").attr("x", (x1 + x2) / 2).attr("y", -52)
        .attr("text-anchor", "middle").attr("class", "city-name").text(c.label);
      grp.append("path").attr("d", `M${x1},-40 v-5 H${x2} v5`).attr("fill", "none").attr("stroke", "#aaa");
      if (i > 0) {
        const xm = (x1 + x(cities[i - 1].key + "|false")) / 2;
        grp.append("line").attr("x1", xm).attr("x2", xm).attr("y1", -64).attr("y2", innerH).attr("stroke", "#f0f0f0");
      }
    });
    axesDef.forEach(a => {
      const t = grp.append("text").attr("x", x(a.key)).attr("text-anchor", "middle").attr("class", "pc-sublabel");
      t.append("tspan").attr("x", x(a.key)).attr("y", -22).text(a.label);
      t.append("tspan").attr("x", x(a.key)).attr("y", -9).attr("class", "n-label").text("n=" + nByAxis[a.key]);
    });
    grp.append("text").attr("x", -12).attr("y", -22).attr("text-anchor", "end")
      .attr("class", "pc-sublabel").style("font-weight", "600").text("Gentrified:");
  }

  // ---- titles / legend / notes ----
  svg.append("text").attr("x", 20).attr("y", 30).attr("class", "pc-headline")
    .text("How Neighborhood Racial Makeup Changed, 2000–2017");
  svg.append("text").attr("x", 20).attr("y", 54).attr("class", "pc-sub")
    .text("Lower-income neighborhoods that gentrified vs. similar ones that didn't. In all five cities, the Black share");
  svg.append("text").attr("x", 20).attr("y", 72).attr("class", "pc-sub")
    .text("fell more in gentrified neighborhoods, while the White share rose.");

  const leg = svg.append("g").attr("transform", "translate(20, 98)");
  let lx = 0;
  races.forEach(r => {
    leg.append("line").attr("x1", lx).attr("x2", lx + 22).attr("y1", 0).attr("y2", 0)
      .attr("stroke", r.color).attr("stroke-width", 3);
    leg.append("text").attr("x", lx + 28).attr("y", 4).attr("class", "pc-leg").text(r.label);
    lx += 40 + r.label.length * 6.6;
  });
  leg.append("line").attr("x1", lx).attr("x2", lx + 22).attr("y1", 0).attr("y2", 0)
    .attr("stroke", "#777").attr("stroke-width", 1.6).attr("stroke-dasharray", "4,3");
  leg.append("text").attr("x", lx + 28).attr("y", 4).attr("class", "pc-leg").text("2000 (in 2017 view)");

  svg.append("text").attr("x", 20).attr("y", H - 30).attr("class", "pc-source")
    .text("Lines = population-weighted average share. Dots = individual neighborhoods. Hispanic/Latino can be of any race, so shares can add to more than 100%.");
  svg.append("text").attr("x", 20).attr("y", H - 14).attr("class", "pc-source")
    .text("Source: BuzzFeed News analysis of U.S. Census data (2000; ACS 2013–2017). 882 census tracts eligible to gentrify in 2000 (289 gentrified, 593 did not).");

  // ---- load ----
  tractsPromise.then(data => {
    const elig = data.filter(d => d.eligible_for_gentrification &&
      races.every(r => ["00", "17"].every(y => d["pct_" + r.key + "_" + y] !== "" && !isNaN(+d["pct_" + r.key + "_" + y]))));

    axesDef.forEach(a => {
      nByAxis[a.key] = elig.filter(d => d.city === a.cityKey && d.gentrified === a.gent).length;
    });

    // population-weighted: total people of that race / total people
    races.forEach(r => {
      vals[r.key] = {};
      axesDef.forEach(a => {
        const sub = elig.filter(d => d.city === a.cityKey && d.gentrified === a.gent);
        const share = y => 100 * d3.sum(sub, d => +d[r.key + "_" + y] || 0) / d3.sum(sub, d => +d["total_population_" + y] || 0);
        const v00 = share("00"), v17 = share("17");
        vals[r.key][a.key] = { "00": v00, "17": v17, "chg": v17 - v00 };
      });
    });

    elig.forEach(d => {
      const axis = d.city + "|" + d.gentrified;
      races.forEach(r => {
        const a = +d["pct_" + r.key + "_00"], b = +d["pct_" + r.key + "_17"];
        dots.push({ axis: axis, race: r.key, jit: (Math.random() - 0.5) * 14, v: { "00": a, "17": b, "chg": b - a } });
      });
    });

    // change scale covers every single tract, so nothing gets cut off
    chgDomain = d3.extent(dots, dt => dt.v.chg);
    yChg = d3.scaleLinear().domain(chgDomain).nice().range([innerH, 0]);

    console.log("white hat: eligible tracts", elig.length, "black D.C. gentrified", vals.black_alone["Washington|true"]);

    drawHeaders();
    render(false);
    drawTractDots(dt => dotY(dt, mode));

    d3.selectAll("#whitehat-controls .seg button").on("click", function () { setMode(this.dataset.mode); });
  });

})();
