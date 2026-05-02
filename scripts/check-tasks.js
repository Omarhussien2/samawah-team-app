const XLSX = require("xlsx");
const wb = XLSX.readFile("مشاريع سماوة.xlsx");
const sheet = wb.Sheets["Tasks"];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
// Print header (keys of first non-empty row)
for (const row of rows) {
  if (row.Task_ID || row["Task Title"]) {
    console.log("COLUMNS:", JSON.stringify(Object.keys(row)));
    console.log("FIRST ROW:", JSON.stringify(row, null, 2));
    break;
  }
}
console.log("TOTAL ROWS:", rows.filter(r => r.Task_ID || r["Task Title"]).length);
