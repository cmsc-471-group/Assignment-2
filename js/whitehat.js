// WHITE HAT chart (Tong)
// idea: avg change in Black population share, gentrified vs eligible-but-not-gentrified, per city

const whMargin = { top: 40, right: 30, bottom: 50, left: 60 },
      whWidth = 900 - whMargin.left - whMargin.right,
      whHeight = 420 - whMargin.top - whMargin.bottom;

const whSvg = d3.select("#whitehat-chart")
  .append("svg")
    .attr("viewBox", `0 0 ${whWidth + whMargin.left + whMargin.right} ${whHeight + whMargin.top + whMargin.bottom}`)
  .append("g")
    .attr("transform", `translate(${whMargin.left},${whMargin.top})`);

tractsPromise.then(function (data) {
  // only tracts that could have gentrified (passed test 1), so the comparison is fair
  let eligible = data.filter(d => d.eligible_for_gentrification && d.pct_black_alone_change != null);

  // quick check that the data is right, delete once the real chart is in
  const summary = d3.rollups(
    eligible,
    v => d3.mean(v, d => d.pct_black_alone_change),
    d => d.city,
    d => d.gentrified ? "gentrified" : "not gentrified"
  );
  console.table(summary.flatMap(([city, groups]) =>
    groups.map(([g, avg]) => ({ city, group: g, avg_black_share_change: avg.toFixed(2) }))
  ));

  // TODO: grouped bar chart from `summary`
  //  - x: city, subgroups gentrified / not gentrified
  //  - y: avg percentage-point change, start at 0, label the units
  //  - legend + source note under the chart
});
