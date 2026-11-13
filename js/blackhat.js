// BLACK HAT chart (Mihail)
// tricks (explain these in the write-up):
//  1. data: only NYC + Baltimore (smallest gaps), DC/Atlanta/Oakland quietly left out, then pooled into one avg
//  2. encoding: y axis -100 to +100 "full range" so a real gap looks like two slivers
//  3. title: "modest" frames it before anyone reads the numbers, subtitle never names the cities
// keep it looking legit (title, legend, source all there)

var bhMargin = {top: 90, right: 40, bottom: 70, left: 70};
var bhW = 900 - bhMargin.left - bhMargin.right;
var bhH = 460 - bhMargin.top - bhMargin.bottom;

var bhRoot = d3.select("#blackhat-chart")
  .append("svg")
  .attr("viewBox", "0 0 " + (bhW + bhMargin.left + bhMargin.right) + " " + (bhH + bhMargin.top + bhMargin.bottom));

var bhSvg = bhRoot.append("g")
  .attr("transform", "translate(" + bhMargin.left + "," + bhMargin.top + ")");

const pickedCities = ["New York City", "Baltimore"];   // <- the cherry pick

tractsPromise.then(data => {
  let rows = data.filter(d =>
    d.eligible_for_gentrification &&
    pickedCities.includes(d.city) &&
    d.pct_black_alone_change != null
  );

  // pool both cities together, so NYC (way more tracts) drowns out the rest
  const bars = [
    { label: "Gentrified neighborhoods", vals: rows.filter(d => d.gentrified) },
    { label: "Other neighborhoods", vals: rows.filter(d => !d.gentrified) }
  ].map(b => ({ label: b.label, n: b.vals.length, avg: d3.mean(b.vals, d => d.pct_black_alone_change) }));

  console.log("black hat bars:", bars);

  const x = d3.scaleBand().domain(bars.map(b => b.label)).range([0, bhW]).padding(0.45);
  // "full possible range" of a percentage-point change, sounds fair but flattens everything
  const y = d3.scaleLinear().domain([-100, 100]).range([bhH, 0]);

  // light gridlines, makes it look careful
  bhSvg.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(8).tickSize(-bhW).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").attr("stroke", "#ececec"));

  bhSvg.append("g")
    .call(d3.axisLeft(y).ticks(8).tickFormat(d => (d > 0 ? "+" : "") + d))
    .call(g => g.select(".domain").remove());

  // zero line
  bhSvg.append("line")
    .attr("x1", 0).attr("x2", bhW)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#555");

  bhSvg.append("g")
    .attr("transform", "translate(0," + bhH + ")")
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").style("font-size", "13px").attr("dy", "1.2em");

  var colors = { "Gentrified neighborhoods": "#4a7fb5", "Other neighborhoods": "#a9c4de" };

  bhSvg.selectAll(".bar")
    .data(bars)
    .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.label))
      .attr("width", x.bandwidth())
      .attr("y", d => d.avg < 0 ? y(0) : y(d.avg))
      .attr("height", d => Math.abs(y(d.avg) - y(0)))
      .attr("fill", d => colors[d.label]);

  // value labels under the bars
  bhSvg.selectAll(".val")
    .data(bars)
    .join("text")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", d => y(d.avg) + 16)
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("fill", "#333")
      .text(d => d.avg.toFixed(1) + " pts");

  // y label
  bhSvg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -bhH / 2).attr("y", -48)
    .attr("text-anchor", "middle")
    .style("font-size", "12px").style("fill", "#444")
    .text("Change in Black share of residents (percentage points)");

  // title + subtitle (the framing)
  bhRoot.append("text")
    .attr("x", bhMargin.left).attr("y", 34)
    .style("font-size", "21px").style("font-weight", "600").style("fill", "#222")
    .text("Neighborhood Change Is Modest, Even in Gentrifying Areas");

  bhRoot.append("text")
    .attr("x", bhMargin.left).attr("y", 58)
    .style("font-size", "14px").style("fill", "#666")
    .text("Average change in Black share of residents per neighborhood, 2000–2017, in major U.S. cities");

  // source note, small, mentions "selected" without saying which
  bhRoot.append("text")
    .attr("x", bhMargin.left)
    .attr("y", bhH + bhMargin.top + bhMargin.bottom - 12)
    .style("font-size", "11px").style("fill", "#888")
    .text("Source: BuzzFeed News analysis of U.S. Census data (2000; ACS 2013–2017). Lower-income neighborhoods in selected metro areas, n = "
          + d3.sum(bars, b => b.n) + ".");
});
