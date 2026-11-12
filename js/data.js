// loads gentrification.csv once, both charts use this
// one row = one census tract (5 cities: Atlanta, Baltimore, New York City, Oakland, Washington)

const numCols = [
  "total_population_17", "total_population_00",
  "median_income_17", "median_income_00",
  "median_home_value_17", "median_home_value_00",
  "pct_white_alone_change", "pct_black_alone_change",
  "pct_asian_alone_change", "pct_hispanic_or_latino_change",
  "pct_black_alone_00", "pct_black_alone_17",
  "home_pct_change"
];

const boolCols = ["gentrified", "eligible_for_gentrification", "low_population"];

function cleanRow(d) {
  numCols.forEach(c => { d[c] = d[c] === "" ? null : +d[c]; });
  for (let i = 0; i < boolCols.length; i++) {
    d[boolCols[i]] = d[boolCols[i]] === "True";
  }
  return d;
}

// promise both chart files can await
const tractsPromise = d3.csv("data/gentrification.csv", cleanRow).then(rows => {
  console.log("tracts loaded:", rows.length);
  console.log("per city:", d3.rollup(rows, v => v.length, d => d.city));
  return rows;
});
