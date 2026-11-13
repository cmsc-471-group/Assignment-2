// BLACK HAT: parallel coordinates, one line per race (Mihail)
// axes = each city split into Gentrified True / False, every axis is a % scale
// axis/scale setup based on syntagmatic's "Exoplanets II" block (one y scale per dimension)
// https://gist.github.com/syntagmatic/482706e0638c67836d94b20f0cb37122
// ported to d3 v7. bold race lines are svg, the faint neighborhood lines are canvas (like the original)
// faint lines: each tract draws one line per race from its own value on its axis
// over to the OTHER group's average in the same city
//
// tricks (full explanation is in the write-up on index.html):
//  1. encoding: every axis has its OWN scale, 0 to that axis's biggest value for the year shown,
//     so the biggest group is always pinned near the top. D.C. True: Black 84.2% -> 57.4%
//     but the line goes UP (94% -> 96% of the axis). Atlanta True: 86.7% -> 63.1%, also goes up (96% -> 97%)
//  2. data: "False" = every other tract in the city, incl. wealthy ones that could never gentrify,
//     not the low-income ones that were eligible but didn't. plain averages, not weighted by population
//  3. title/labels: "held steady" + "flip between years to see for yourself"

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

  // one axis per city per gentrified status
  const axesDef = cities.flatMap(c => [true, false].map(gv => ({
    key: c.key + "|" + gv,
    city: c.label,
    label: gv ? "True" : "False",
    test: d => d.city === c.key && d.gentrified === gv
  })));

  const W = 900, H = 520;
  const margin = { top: 150, right: 30, bottom: 50, left: 100 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  let year = "00";
  let vals = {};      // vals[raceKey][axisKey][year]
  let tracts = [];
  let hoverKey = null;
  let yScales = {};

  const holder = d3.select("#blackhat-chart")
    .classed("pc-holder", true)
    .style("aspect-ratio", W + " / " + H);

  d3.select("#blackhat-controls").html(`
    <span class="yr-label" data-yr="00">2000</span>
    <label class="switch"><input type="checkbox" id="yearSwitch"><span class="slider"></span></label>
    <span class="yr-label" data-yr="17">2017</span>
    <span class="pc-count">Hover a line for exact values</span>`);

  const dpr = window.devicePixelRatio || 1;
  const canvas = holder.append("canvas").attr("width", W * dpr).attr("height", H * dpr).node();
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const svg = holder.append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tip = d3.select("body").append("div").attr("class", "tooltip");

  const x = d3.scalePoint().domain(axesDef.map(a => a.key)).range([0, innerW]).padding(0.15);

  function refit() {
    axesDef.forEach(a => {
      const mx = d3.max(races, r => vals[r.key][a.key][year]);
      yScales[a.key] = d3.scaleLinear().domain([0, mx]).nice().range([innerH, 0]);
    });
  }

  const pts = r => axesDef.map(a => [x(a.key), yScales[a.key](vals[r.key][a.key][year])]);
  const lineGen = d3.line();

  // [x1, y1, x2, y2] for one tract + race, using the current year's scales
  function faintSeg(t, r) {
    const own = t.axis, other = t.other;
    return [
      x(own) + margin.left,   yScales[own](t[r.key + "_" + year]) + margin.top,
      x(other) + margin.left, yScales[other](vals[r.key][other][year]) + margin.top
    ];
  }

  function allSegs() {
    const out = new Map();
    races.forEach(r => out.set(r.key, tracts.map(t => faintSeg(t, r))));
    return out;
  }

  function drawFaint(segs) {
    ctx.clearRect(0, 0, W, H);
    // cut everything off at the top of the axes. single tracts go way past the axis max
    // (the axes only go up to the biggest AVERAGE) so those just get chopped
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, margin.top, W, innerH);
    ctx.clip();
    ctx.lineWidth = 0.8;

    races.forEach(r => {
      if (hoverKey && hoverKey !== r.key) return;
      ctx.strokeStyle = r.color;
      const sg = segs.get(r.key);
      // fade more where there are lots of tracts (NYC) so it doesnt turn into a block
      d3.groups(sg.map((v, i) => [v, tracts[i].axis]), d => d[1]).forEach(([ax, rows]) => {
        let a = Math.max(0.02, Math.min(0.15, 1.5 / Math.sqrt(rows.length)));
        ctx.globalAlpha = hoverKey ? Math.min(0.5, a * 2.5) : a;
        ctx.beginPath();
        rows.forEach(([v]) => { ctx.moveTo(v[0], v[1]); ctx.lineTo(v[2], v[3]); });
        ctx.stroke();
      });
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // tween the faint lines along with the svg transition
  function animateFaint(before, after) {
    const t = d3.timer(el => {
      const k = d3.easeCubicInOut(Math.min(1, el / 800));
      const mid = new Map();
      races.forEach(r => {
        const a = before.get(r.key), b = after.get(r.key);
        mid.set(r.key, a.map((sg, i) => [sg[0], sg[1] + (b[i][1] - sg[1]) * k, sg[2], sg[3] + (b[i][3] - sg[3]) * k]));
      });
      drawFaint(mid);
      if (k >= 1) t.stop();
    });
  }

  function render(animate) {
    const dur = animate ? 800 : 0;

    const ax = g.selectAll(".pc-axis").data(axesDef, a => a.key);
    const axEnter = ax.enter().append("g")
      .attr("class", "pc-axis")
      .attr("transform", a => `translate(${x(a.key)},0)`);
    axEnter.append("g").attr("class", "ticks");
    axEnter.append("text")
      .attr("class", "pc-sublabel")
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .text(a => a.label);

    axEnter.merge(ax).select(".ticks").each(function (a) {
      d3.select(this).transition().duration(dur)
        .call(d3.axisLeft(yScales[a.key]).ticks(5).tickSize(4).tickFormat(v => v + "%"));
    });

    // biggest groups drawn last so they sit on top
    const ln = g.selectAll(".race-line").data(races.slice().reverse(), r => r.key);
    ln.enter().append("path")
        .attr("class", "race-line")
        .attr("fill", "none")
        .attr("stroke", r => r.color)
        .attr("stroke-width", 3)
        .attr("stroke-linejoin", "round")
        .attr("d", r => lineGen(pts(r)))
        .on("mouseover", (e, r) => highlight(r.key))
        .on("mousemove", (e, r) => showTip(e, r))
        .on("mouseout", () => { highlight(null); tip.style("opacity", 0); })
      .merge(ln)
        .transition().duration(dur)
        .attr("d", r => lineGen(pts(r)));

    const dotData = races.flatMap(r => axesDef.map(a => ({ r: r, a: a })));
    const dots = g.selectAll(".race-dot").data(dotData, d => d.r.key + "|" + d.a.key);
    dots.enter().append("circle")
        .attr("class", "race-dot")
        .attr("r", 4)
        .attr("fill", d => d.r.color)
        .attr("stroke", "white").attr("stroke-width", 1.2)
        .attr("cx", d => x(d.a.key))
        .attr("cy", d => yScales[d.a.key](vals[d.r.key][d.a.key][year]))
        .on("mouseover", (e, d) => highlight(d.r.key))
        .on("mousemove", (e, d) => showTip(e, d.r))
        .on("mouseout", () => { highlight(null); tip.style("opacity", 0); })
      .merge(dots)
        .transition().duration(dur)
        .attr("cy", d => yScales[d.a.key](vals[d.r.key][d.a.key][year]));

    d3.selectAll("#blackhat-controls .yr-label").classed("on", function () { return this.dataset.yr === year; });
  }

  function drawCityHeaders() {
    const grp = g.append("g").attr("class", "city-labels");
    grp.append("text")
      .attr("x", x(axesDef[0].key) - 22).attr("y", -12)
      .attr("text-anchor", "end")
      .attr("class", "pc-sublabel").style("font-weight", "600")
      .text("Gentrified:");
    cities.forEach((c, i) => {
      const x1 = x(c.key + "|true"), x2 = x(c.key + "|false");
      grp.append("text")
        .attr("x", (x1 + x2) / 2).attr("y", -42)
        .attr("text-anchor", "middle")
        .attr("class", "city-name")
        .text(c.label);
      grp.append("path")
        .attr("d", `M${x1},-30 v-5 H${x2} v5`)
        .attr("fill", "none").attr("stroke", "#aaa");
      if (i > 0) {
        const xm = (x1 + x(cities[i - 1].key + "|false")) / 2;
        grp.append("line")
          .attr("x1", xm).attr("x2", xm).attr("y1", -56).attr("y2", innerH)
          .attr("stroke", "#eee");
      }
    });
  }

  function highlight(key) {
    hoverKey = key;
    drawFaint(allSegs());
    g.selectAll(".race-line").attr("opacity", r => key == null || r.key === key ? 1 : 0.12);
    g.selectAll(".race-dot").attr("opacity", d => key == null || d.r.key === key ? 1 : 0.12);
  }

  function showTip(e, r) {
    let rows = cities.map(c => {
      const t = vals[r.key][c.key + "|true"][year], f = vals[r.key][c.key + "|false"][year];
      return `${c.label}: <b>${t.toFixed(1)}%</b> / ${f.toFixed(1)}%`;
    }).join("<br>");
    tip.html(`<b style="color:${r.color}">${r.label}</b> (${year === "00" ? "2000" : "2017"})<br>
              <span style="color:#777">gentrified / not</span><br>${rows}`)
      .style("left", (e.pageX + 14) + "px")
      .style("top", (e.pageY - 20) + "px")
      .style("opacity", 1);
  }

  // ---- titles ----
  svg.append("text").attr("x", 20).attr("y", 30).attr("class", "pc-headline")
    .text("Neighborhood Racial Makeup Has Held Steady Since 2000");
  svg.append("text").attr("x", 20).attr("y", 54).attr("class", "pc-sub")
    .text("Average share of residents by race, gentrified vs. other neighborhoods in each city. Flip between years to see for yourself.");

  const leg = svg.append("g").attr("transform", "translate(20, 80)");
  let lx = 0;
  races.forEach(r => {
    leg.append("line").attr("x1", lx).attr("x2", lx + 22).attr("y1", 0).attr("y2", 0)
      .attr("stroke", r.color).attr("stroke-width", 3);
    leg.append("text").attr("x", lx + 28).attr("y", 4).attr("class", "pc-leg").text(r.label);
    lx += 40 + r.label.length * 6.6;
  });

  svg.append("text").attr("x", 20).attr("y", H - 14).attr("class", "pc-source")
    .text("Source: BuzzFeed News analysis of U.S. Census data (2000; ACS 2013–2017), 2,750 census tracts.");

  // ---- load ----
  tractsPromise.then(data => {
    const good = data.filter(d =>
      races.every(r => ["00", "17"].every(y => d["pct_" + r.key + "_" + y] !== "" && !isNaN(+d["pct_" + r.key + "_" + y]))));

    tracts = good.map(d => {
      const o = { axis: d.city + "|" + d.gentrified, other: d.city + "|" + (!d.gentrified) };
      races.forEach(r => {
        o[r.key + "_00"] = +d["pct_" + r.key + "_00"];
        o[r.key + "_17"] = +d["pct_" + r.key + "_17"];
      });
      return o;
    });

    races.forEach(r => {
      vals[r.key] = {};
      axesDef.forEach(a => {
        const sub = good.filter(a.test);
        vals[r.key][a.key] = {
          "00": d3.mean(sub, d => +d["pct_" + r.key + "_00"]),
          "17": d3.mean(sub, d => +d["pct_" + r.key + "_17"])
        };
      });
    });
    console.log("black, D.C. gentrified:", vals.black_alone["Washington|true"]);

    refit();
    drawCityHeaders();
    render(false);
    drawFaint(allSegs());

    function setYear(y) {
      if (y === year) return;
      const before = allSegs();
      year = y;
      refit();
      render(true);
      animateFaint(before, allSegs());
    }

    d3.select("#yearSwitch").on("change", function () { setYear(this.checked ? "17" : "00"); });
    d3.selectAll("#blackhat-controls .yr-label").on("click", function () {
      d3.select("#yearSwitch").property("checked", this.dataset.yr === "17");
      setYear(this.dataset.yr);
    });
  });

})();
