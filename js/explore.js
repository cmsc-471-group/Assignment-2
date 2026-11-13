// exploration charts, just to see what the data says
// uses tractsPromise from data.js

const cityOrder = ["Washington", "Atlanta", "Oakland", "Baltimore", "New York City"];
const W = 900, H = 400;
const tip = d3.select("#tip");

function showTip(evt, html) {
  tip.html(html)
    .style("left", (evt.pageX + 12) + "px")
    .style("top", (evt.pageY - 10) + "px")
    .style("opacity", 1);
}
function hideTip() { tip.style("opacity", 0); }

tractsPromise.then(data => {
  let eligible = data.filter(d => d.eligible_for_gentrification);
  chartOne(eligible);
  chartTwo(eligible.filter(d => d.gentrified));
  chart3(eligible);
});


// ---------- 1: grouped bars ----------
function chartOne(rows) {
  const m = {top: 30, right: 20, bottom: 40, left: 60};
  const w = W - m.left - m.right, h = H - m.top - m.bottom;

  const svg = d3.select("#ex1").append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .append("g").attr("transform", `translate(${m.left},${m.top})`);

  const keys = ["Gentrified", "Not gentrified"];
  const summary = cityOrder.map(city => {
    const inCity = rows.filter(d => d.city === city && d.pct_black_alone_change != null);
    const g = inCity.filter(d => d.gentrified), ng = inCity.filter(d => !d.gentrified);
    return {
      city: city,
      "Gentrified": d3.mean(g, d => d.pct_black_alone_change),
      "Not gentrified": d3.mean(ng, d => d.pct_black_alone_change),
      nG: g.length, nNG: ng.length
    };
  });

  const x0 = d3.scaleBand().domain(cityOrder).range([0, w]).padding(0.25);
  const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.08);
  const y = d3.scaleLinear().domain([-30, 5]).range([h, 0]);
  const color = d3.scaleOrdinal().domain(keys).range(["#c0392b", "#9aa5b1"]);

  svg.append("g").call(d3.axisLeft(y).ticks(7).tickFormat(d => d + " pts"));
  svg.append("g").attr("transform", `translate(0,${y(0)})`)
    .call(d3.axisBottom(x0).tickSize(0).tickFormat(""));
  // city names at the bottom so they dont sit on top of the bars
  svg.append("g").attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x0).tickSize(0)).select(".domain").remove();

  const grp = svg.selectAll(".city").data(summary).join("g")
    .attr("transform", d => `translate(${x0(d.city)},0)`);

  grp.selectAll("rect")
    .data(d => keys.map(k => ({key: k, val: d[k], city: d.city, n: k === "Gentrified" ? d.nG : d.nNG})))
    .join("rect")
      .attr("x", d => x1(d.key))
      .attr("width", x1.bandwidth())
      .attr("y", d => d.val < 0 ? y(0) : y(d.val))
      .attr("height", d => Math.abs(y(d.val) - y(0)))
      .attr("fill", d => color(d.key))
      .on("mousemove", (e, d) => showTip(e, `<b>${d.city}</b><br>${d.key}: ${d.val.toFixed(1)} pts<br>${d.n} tracts`))
      .on("mouseout", hideTip);

  const lg = svg.append("g").attr("class", "legend").attr("transform", `translate(${w - 170}, ${y(-24)})`);
  keys.forEach((k, i) => {
    lg.append("rect").attr("y", i * 20).attr("width", 12).attr("height", 12).attr("fill", color(k));
    lg.append("text").attr("x", 18).attr("y", i * 20 + 10).text(k);
  });
}


// ---------- 2: dot plot by group ----------
function chartTwo(gent) {
  var m = {top: 40, right: 30, bottom: 40, left: 120};
  var w = W - m.left - m.right, h = 320 - m.top - m.bottom;

  var svg = d3.select("#ex2").append("svg")
    .attr("viewBox", "0 0 " + W + " 320")
    .append("g").attr("transform", "translate(" + m.left + "," + m.top + ")");

  var groups = [
    {col: "pct_white_alone_change", label: "White", c: "#2a5d9f"},
    {col: "pct_black_alone_change", label: "Black", c: "#c0392b"},
    {col: "pct_hispanic_or_latino_change", label: "Hispanic/Latino", c: "#e69f00"},
    {col: "pct_asian_alone_change", label: "Asian", c: "#2e8b57"}
  ];

  var pts = [];
  cityOrder.forEach(function (city) {
    var rows = gent.filter(d => d.city === city);
    groups.forEach(function (g) {
      pts.push({city: city, label: g.label, c: g.c, val: d3.mean(rows, d => d[g.col]), n: rows.length});
    });
  });

  var x = d3.scaleLinear().domain([-30, 25]).range([0, w]);
  var y = d3.scalePoint().domain(cityOrder).range([0, h]).padding(0.5);

  svg.append("g").attr("transform", "translate(0," + h + ")")
    .call(d3.axisBottom(x).tickFormat(d => (d > 0 ? "+" : "") + d + " pts"));
  svg.append("g").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();

  // zero line
  svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", h)
    .attr("stroke", "#999").attr("stroke-dasharray", "3,3");

  // light guide line per city
  svg.selectAll(".guide").data(cityOrder).join("line")
    .attr("x1", 0).attr("x2", w)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", "#eee");

  svg.selectAll("circle").data(pts).join("circle")
    .attr("cx", d => x(d.val)).attr("cy", d => y(d.city))
    .attr("r", 7).attr("fill", d => d.c).attr("opacity", 0.9)
    .on("mousemove", (e, d) => showTip(e, "<b>" + d.city + "</b><br>" + d.label + ": " + d.val.toFixed(1) + " pts<br>(" + d.n + " gentrified tracts)"))
    .on("mouseout", hideTip);

  var lg = svg.append("g").attr("class", "legend").attr("transform", "translate(0,-28)");
  groups.forEach(function (g, i) {
    lg.append("circle").attr("cx", i * 130 + 6).attr("cy", 0).attr("r", 6).attr("fill", g.c);
    lg.append("text").attr("x", i * 130 + 16).attr("y", 4).text(g.label);
  });
}


// ---------- 3: scatter ----------
function chart3(rows) {
  const m = {top: 30, right: 20, bottom: 50, left: 60};
  const w = W - m.left - m.right, h = 440 - m.top - m.bottom;

  const pts = rows.filter(d => d.home_pct_change != null && d.pct_black_alone_change != null
                               && d.home_pct_change > -1);

  const svg = d3.select("#ex3").append("svg")
    .attr("viewBox", `0 0 ${W} 440`)
    .append("g").attr("transform", `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([-0.6, 1]).range([0, w]).clamp(true);
  const y = d3.scaleLinear().domain([-70, 40]).range([h, 0]);

  svg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("+.0%")));
  svg.append("g").call(d3.axisLeft(y).tickFormat(d => d + " pts"));

  svg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#bbb").attr("stroke-dasharray", "3,3");

  svg.append("text").attr("class", "axis-label").attr("x", w / 2).attr("y", h + 40)
    .attr("text-anchor", "middle").text("Change in median home value, 2000 to 2017 (inflation-adjusted)");
  svg.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)")
    .attr("x", -h / 2).attr("y", -46).attr("text-anchor", "middle").text("Change in Black share (pts)");

  // draw not-gentrified first so the red ones sit on top
  pts.sort((a, b) => a.gentrified - b.gentrified);

  svg.selectAll("circle").data(pts).join("circle")
    .attr("cx", d => x(d.home_pct_change))
    .attr("cy", d => y(d.pct_black_alone_change))
    .attr("r", 3.5)
    .attr("fill", d => d.gentrified ? "#c0392b" : "#9aa5b1")
    .attr("opacity", d => d.gentrified ? 0.75 : 0.45)
    .on("mousemove", (e, d) => showTip(e,
      `<b>${d.name}</b><br>${d.city}<br>Home value: ${d3.format("+.0%")(d.home_pct_change)}<br>Black share: ${d.pct_black_alone_change.toFixed(1)} pts`))
    .on("mouseout", hideTip);

  const lg = svg.append("g").attr("class", "legend").attr("transform", `translate(${w - 140}, 6)`);
  [["Gentrified", "#c0392b"], ["Not gentrified", "#9aa5b1"]].forEach((p, i) => {
    lg.append("circle").attr("cx", 6).attr("cy", i * 20).attr("r", 5).attr("fill", p[1]);
    lg.append("text").attr("x", 16).attr("y", i * 20 + 4).text(p[0]);
  });
}
