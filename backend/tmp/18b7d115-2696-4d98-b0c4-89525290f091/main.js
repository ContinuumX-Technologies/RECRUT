
System.out.print("16");

const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();
const args = JSON.parse(input);

const start = Date.now();
const result = solution(...args);
console.log(JSON.stringify(result));
console.log("TIME_MS=" + (Date.now() - start));
