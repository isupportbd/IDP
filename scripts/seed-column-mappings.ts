// @ts-nocheck
import { initDatabase } from "../src/framework/database/connection.js";
import { db } from "../src/framework/facade.js";
import { columnMappings } from "../src/modules/superadmin/database/models/column_mappings.js";

async function main() {
  await initDatabase();
  console.log("Seeding default column mappings...");

  const defaults = [
    { dbColumn: "office", label: "office", excelHeader: "Office", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "beNo", label: "be_no", excelHeader: "BE No", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "beDate", label: "be_date", excelHeader: "Date", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "hsCode", label: "hs_code", excelHeader: "HS Code", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "itemName", label: "item_name", excelHeader: "Item Name", isCalculated: false, isFromDb: true, isRegexExtracted: false },
    { dbColumn: "lcNumber", label: "lc_number", excelHeader: "LC Number", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "netWt", label: "net_wt", excelHeader: "Net Wt", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "excessQty", label: "excess_qty", excelHeader: "Excess Qty", isCalculated: false, isFromDb: false, isRegexExtracted: true },
    { dbColumn: "totalQty", label: "total_qty", excelHeader: "", isCalculated: true, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "assValue", label: "ass_value", excelHeader: "Ass. Value", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "cd", label: "cd", excelHeader: "CD", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "rd", label: "rd", excelHeader: "RD", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "sd", label: "sd", excelHeader: "SD", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "baseValueOfVat", label: "base_value_of_vat", excelHeader: "", isCalculated: true, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "vat", label: "vat", excelHeader: "VAT", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "unitValue", label: "unit_value", excelHeader: "", isCalculated: true, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "at", label: "at", excelHeader: "AT", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "bin", label: "bin", excelHeader: "BIN", isCalculated: false, isFromDb: false, isRegexExtracted: false },
    { dbColumn: "clientName", label: "client_name", excelHeader: "Client Name", isCalculated: false, isFromDb: false, isRegexExtracted: false }
  ];

  for (const row of defaults) {
    await db
      .insert(columnMappings)
      .values(row)
      .onConflictDoUpdate({
        target: columnMappings.dbColumn,
        set: {
          label: row.label,
          isCalculated: row.isCalculated,
          isFromDb: row.isFromDb,
          isRegexExtracted: row.isRegexExtracted
        }
      });
  }

  console.log("Column mappings seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding column mappings:", err);
  process.exit(1);
});
