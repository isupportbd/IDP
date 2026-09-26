// @ts-nocheck
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const headers = [
  "Company Name",
  "Proprietor Name",
  "BIN Number",
  "Mobile",
  "Alternative Mobile",
  "Email",
  "TIN Number",
  "Trade License No",
  "Address",
  "Customer Type",
  "Reference",
  "VAT User ID",
  "VAT Password",
  "VAT Service Type",
  "Notes"
];

// Sample guideline row (Row 2 can be sample data or blank)
const sampleData = [
  {
    "Company Name": "Example Trading Ltd",
    "Proprietor Name": "Md. Rafiqul Islam",
    "BIN Number": "001234567-0101",
    "Mobile": "01711002233",
    "Alternative Mobile": "01812345678",
    "Email": "info@exampletrading.com",
    "TIN Number": "123456789012",
    "Trade License No": "TRAD/DSCC/012345/2026",
    "Address": "House 12, Road 5, Motijheel C/A, Dhaka-1000",
    "Customer Type": "Trader",
    "Reference": "Direct",
    "VAT User ID": "example_vat",
    "VAT Password": "Password@123",
    "VAT Service Type": "FULL",
    "Notes": "Priority client"
  }
];

// Create workbook with two sheets: 1. Blank Sheet (for actual upload), 2. Sample Guide
const wb = XLSX.utils.book_new();

// Sheet 1: Blank Sheet with only Headers
const blankWs = XLSX.utils.aoa_to_sheet([headers]);
// Set column widths
blankWs["!cols"] = [
  { wch: 25 }, // Company Name
  { wch: 20 }, // Proprietor Name
  { wch: 18 }, // BIN Number
  { wch: 16 }, // Mobile
  { wch: 18 }, // Alternative Mobile
  { wch: 25 }, // Email
  { wch: 18 }, // TIN Number
  { wch: 22 }, // Trade License No
  { wch: 35 }, // Address
  { wch: 16 }, // Customer Type
  { wch: 16 }, // Reference
  { wch: 18 }, // VAT User ID
  { wch: 18 }, // VAT Password
  { wch: 18 }, // VAT Service Type
  { wch: 25 }  // Notes
];
XLSX.utils.book_append_sheet(wb, blankWs, "Client Import");

// Sheet 2: Sample Example with Guideline
const sampleWs = XLSX.utils.json_to_sheet(sampleData, { header: headers });
sampleWs["!cols"] = blankWs["!cols"];
XLSX.utils.book_append_sheet(wb, sampleWs, "Sample Example");

const outDirs = [
  path.resolve("d:/Softwares/Apps Portal/IDP-V2/public/templates"),
  path.resolve("d:/Softwares/Apps Portal/IDP-V2/src/resources/public/templates"),
  path.resolve("d:/Softwares/Apps Portal/IDP-V2")
];

for (const dir of outDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const xlsxPath = path.resolve("d:/Softwares/Apps Portal/IDP-V2/public/templates/client_bulk_import_template.xlsx");
const rootXlsxPath = path.resolve("d:/Softwares/Apps Portal/IDP-V2/client_bulk_import_template.xlsx");
const srcPublicXlsxPath = path.resolve("d:/Softwares/Apps Portal/IDP-V2/src/resources/public/templates/client_bulk_import_template.xlsx");

XLSX.writeFile(wb, xlsxPath);
XLSX.writeFile(wb, rootXlsxPath);
XLSX.writeFile(wb, srcPublicXlsxPath);

// Also generate CSV format
const csvContent = headers.join(",") + "\n" +
  `"Example Trading Ltd","Md. Rafiqul Islam","001234567-0101","01711002233","01812345678","info@exampletrading.com","123456789012","TRAD/DSCC/012345/2026","House 12, Road 5, Motijheel C/A, Dhaka-1000","Trader","Direct","example_vat","Password@123","FULL","Priority client"\n`;

const blankCsv = headers.join(",") + "\n";

fs.writeFileSync(path.resolve("d:/Softwares/Apps Portal/IDP-V2/public/templates/client_bulk_import_template.csv"), blankCsv);
fs.writeFileSync(path.resolve("d:/Softwares/Apps Portal/IDP-V2/client_bulk_import_template.csv"), blankCsv);

console.log("Excel and CSV templates created successfully!");
