// BLACK HAT chart (Mihail)
// pick 2+: cherry pick cities/years, counts instead of rates, y axis not at 0, slanted title
// keep it looking legit (title, legend, source all there)

var bhMargin = {top: 40, right: 30, bottom: 50, left: 60};
var bhW = 900 - bhMargin.left - bhMargin.right;
var bhH = 420 - bhMargin.top - bhMargin.bottom;

var bhSvg = d3.select("#blackhat-chart")
  .append("svg")
  .attr("viewBox", "0 0 " + (bhW + bhMargin.left + bhMargin.right) + " " + (bhH + bhMargin.top + bhMargin.bottom))
  .append("g")
  .attr("transform", "translate(" + bhMargin.left + "," + bhMargin.top + ")");

tractsPromise.then(data => {
  const gent = data.filter(d => d.gentrified);
  console.log("gentrified tracts:", gent.length);

  // TODO: black hat chart
});
