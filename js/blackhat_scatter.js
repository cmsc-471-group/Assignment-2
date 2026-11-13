// BLACK HAT option B: scatter (Mihail)
// story we're pushing: "rising home prices CAUSE black residents to leave"
// tricks (for the write-up):
//  1. data: only DC + Atlanta, the 2 cities where the link is strongest (r about -0.6).
//     NYC has basically no link (r about -0.02) and it's left out. also tracts outside the y range are dropped
//  2. encoding: y axis zoomed to -35..+10 so the slope looks steep, thick trend line over faded dots
//     makes it look way more certain than r = -0.53 is. no r shown anywhere
//  3. labels: causal title ("pushing out"), and the slope is percentage POINTS of share
//     but the subtitle calls it a "% smaller Black population"

const cities_B = ["Washington", "Atlanta"];

const mB = {top: 95, right: 40, bottom: 75, left: 70};
const wB = 900 - mB.left - mB.right;
const hB = 480 - mB.top - mB.bottom;

const rootB = d3.select("#blackhat-chart-2").append("svg")
  .attr("viewBox", `0 0 ${wB + mB.left + mB.right} ${hB + mB.top + mB.bottom}`);
const gB = rootB.append("g").attr("transform", `translate(${mB.left},${mB.top})`);

// simple least squares, returns slope + intercept
function fitLine(pts) {
  let mx = d3.mean(pts, p => p.x), my = d3.mean(pts, p => p.y);
  let num = 0, den = 0;
  pts.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  const slope = num / den;
  return { slope: slope, intercept: my - slope * mx };
}

tractsPromise.then(function (data) {
  var yLo = -35, yHi = 10;

  var all = data
    .filter(d => d.eligible_for_gentrification && cities_B.includes(d.city))
    .filter(d => d.home_pct_change != null && d.pct_black_alone_change != null)
    .filter(d => d.home_pct_change > -1 && d.home_pct_change <= 1.5)
    .map(d => ({ x: d.home_pct_change, y: d.pct_black_alone_change, name: d.name }));

  // fit on all of them, then only DRAW the ones inside the zoomed axis
  const line = fitLine(all);
  const shown = all.filter(p => p.y >= yLo && p.y <= yHi && p.x >= -0.4 && p.x <= 0.9);
  console.log("scatter B: fit on", all.length, "drawn", shown.length, "slope", line.slope.toFixed(1));

  const x = d3.scaleLinear().domain([-0.4, 0.9]).range([0, wB]);
  const y = d3.scaleLinear().domain([yLo, yHi]).range([hB, 0]);

  // grid
  gB.append("g")
    .call(d3.axisLeft(y).ticks(9).tickSize(-wB).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke", "#eee"));

  gB.append("g").attr("transform", `translate(0,${hB})`)
    .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format("+.0%")));
  gB.append("g")
    .call(d3.axisLeft(y).ticks(9).tickFormat(d => (d > 0 ? "+" : "") + d))
    .call(g => g.select(".domain").remove());

  gB.append("line")
    .attr("x1", 0).attr("x2", wB).attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#999");

  // faded dots, all one color (no gentrified / not split)
  gB.selectAll("circle").data(shown).join("circle")
    .attr("cx", p => x(p.x))
    .attr("cy", p => y(p.y))
    .attr("r", 4)
    .attr("fill", "#7f8c99")
    .attr("opacity", 0.35);

  // the bold trend line
  const x0 = x.domain()[0], x1 = x.domain()[1];
  gB.append("line")
    .attr("x1", x(x0)).attr("y1", y(line.intercept + line.slope * x0))
    .attr("x2", x(x1)).attr("y2", y(line.intercept + line.slope * x1))
    .attr("stroke", "#b03a2e")
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round");

  let per10 = Math.abs(line.slope / 10).toFixed(1);

  gB.append("text")
    .attr("x", x(0.12)).attr("y", y(line.intercept + line.slope * 0.12) - 14)
    .attr("text-anchor", "start")
    .style("paint-order", "stroke").style("stroke", "white").style("stroke-width", "4px")
    .style("font-size", "13px").style("font-weight", "600").style("fill", "#b03a2e")
    .text("−" + per10 + "% for every +10% in home value");

  // axis labels
  gB.append("text")
    .attr("x", wB / 2).attr("y", hB + 42).attr("text-anchor", "middle")
    .style("font-size", "12px").style("fill", "#444")
    .text("Change in median home value, 2000–2017 (adjusted for inflation)");
  gB.append("text")
    .attr("transform", "rotate(-90)").attr("x", -hB / 2).attr("y", -48)
    .attr("text-anchor", "middle")
    .style("font-size", "12px").style("fill", "#444")
    .text("Change in Black population (%)");

  rootB.append("text")
    .attr("x", mB.left).attr("y", 36)
    .style("font-size", "21px").style("font-weight", "600").style("fill", "#222")
    .text("Rising Home Prices Are Pushing Black Residents Out");

  rootB.append("text")
    .attr("x", mB.left).attr("y", 60)
    .style("font-size", "14px").style("fill", "#666")
    .text("Each 10% jump in home value means a " + per10 + "% smaller Black population in a neighborhood");

  rootB.append("text")
    .attr("x", mB.left).attr("y", hB + mB.top + mB.bottom - 12)
    .style("font-size", "11px").style("fill", "#888")
    .text("Source: BuzzFeed News analysis of U.S. Census data (2000; ACS 2013–2017). Lower-income neighborhoods in two major U.S. cities.");
});
