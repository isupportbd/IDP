import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import * as XLSX from "xlsx";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { columnMappings } from "@/modules/superadmin/database/models/column_mappings.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { purchases } from "@/modules/clients/database/models/purchases.js";
import { users } from "@/modules/auth/database/models/user.js";

const round2 = (val: number): number => Math.round(val * 100) / 100;

const parseNumber = (val: any): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parseDateValue = (val: any): string => {
  if (!val) return "";
  if (typeof val === "number") {
    const utc_days = Math.floor(val - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    const match = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const dd = match[1].padStart(2, "0");
      const mm = match[2].padStart(2, "0");
      const yyyy = match[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return val.split(" ")[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return String(val);
};

function formatStandardHsCode(code: string | null | undefined): string {
  if (!code) return "";
  const clean = String(code).trim();
  if (clean.includes(".")) return clean;
  const digits = clean.replace(/[^0-9a-zA-Z]/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  } else if (digits.length === 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`;
  }
  return clean;
}

// ── 1. PROCESS UPLOADED EXCEL/CSV FILE ────────────────────────────────

export const processUpload: Handler = async (c: any) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const month = body["month"] || "";
    const isRebate = body["isRebate"] === "true" || body["isRebate"] === true;
    const isFfs = body["isFfs"] === "true" || body["isFfs"] === true;

    if (!file || !(file instanceof File)) {
      return c.json({ success: false, message: "No valid file uploaded." }, HttpStatusCodes.BAD_REQUEST);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Load active column mappings from DB
    const dbMappings = await db.select().from(columnMappings);

    // ── Smart Header Detection ──────────────────────────────────────────
    // Extracts headers even if top rows contain logos, dates, or titles
    const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

    if (!rawGrid || rawGrid.length === 0) {
      return c.json({ success: false, message: "The uploaded file is empty." }, HttpStatusCodes.BAD_REQUEST);
    }

    const mappingHeaderAliases = dbMappings
      .filter((m) => m.excelHeader && m.excelHeader.trim())
      .map((m) => m.excelHeader.trim().toLowerCase().replace(/[\s\.\_\-\/]+/g, ""));

    let bestHeaderRowIndex = 0;
    let maxMatchCount = 0;
    const scanLimit = Math.min(10, rawGrid.length);

    for (let r = 0; r < scanLimit; r++) {
      const rowCells = rawGrid[r];
      if (!Array.isArray(rowCells)) continue;

      let matchCount = 0;
      for (const cell of rowCells) {
        if (cell === undefined || cell === null || cell === "") continue;
        const cleanCell = String(cell).trim().toLowerCase().replace(/[\s\.\_\-\/]+/g, "");
        if (!cleanCell) continue;

        if (mappingHeaderAliases.includes(cleanCell)) {
          matchCount += 2;
        } else if (
          cleanCell.includes("beno") ||
          cleanCell === "be" ||
          cleanCell.includes("hscode") ||
          cleanCell.includes("netwt") ||
          cleanCell.includes("assessable") ||
          cleanCell.includes("assvalue") ||
          cleanCell.includes("itemname") ||
          cleanCell.includes("commodity") ||
          cleanCell.includes("description") ||
          cleanCell.includes("desc") ||
          cleanCell.includes("lcnumber")
        ) {
          matchCount += 1;
        }
      }

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestHeaderRowIndex = r;
      }
    }

    let rawData: any[] = [];
    if (maxMatchCount >= 2) {
      const headerRow = rawGrid[bestHeaderRowIndex].map((h: any) => String(h || "").trim());
      for (let i = bestHeaderRowIndex + 1; i < rawGrid.length; i++) {
        const rowArr = rawGrid[i];
        if (!Array.isArray(rowArr) || rowArr.every((cell) => cell === "" || cell === null || cell === undefined)) {
          continue;
        }
        const rowObj: any = {};
        headerRow.forEach((headerName: string, colIdx: number) => {
          if (headerName) {
            rowObj[headerName] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : null;
          }
        });
        rawData.push(rowObj);
      }
    } else {
      rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: null });
    }

    if (!rawData || rawData.length === 0) {
      return c.json({ success: false, message: "The uploaded file is empty." }, HttpStatusCodes.BAD_REQUEST);
    }

    const processedData: any[] = [];

    for (const row of rawData) {
      const mappedRow: any = {};

      for (const mapping of dbMappings) {
        if (!mapping.excelHeader || !mapping.excelHeader.trim()) continue;
        const cleanExcelHeader = mapping.excelHeader.trim().toLowerCase().replace(/[\s\.\_\-\/]+/g, "");
        const rowKey = Object.keys(row).find(
          (k) => k.trim().toLowerCase().replace(/[\s\.\_\-\/]+/g, "") === cleanExcelHeader
        );

        if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== "") {
          let val = row[rowKey];
          const dbCol = mapping.dbColumn;

          // Smart regex extraction for excess_qty
          if (dbCol === "excessQty" || mapping.isRegexExtracted) {
            const cleanVal = String(val).replace(/,/g, "");
            const keywordMatch = cleanVal.match(/(?:ex(?:ceess|cess)?|qty)[\s:]*(\d+(\.\d+)?)/i);
            if (keywordMatch && keywordMatch[1]) {
              val = parseNumber(keywordMatch[1]);
            } else {
              const numbers = cleanVal.match(/\d+(\.\d+)?/g);
              if (numbers && numbers.length > 0) {
                val = parseNumber(numbers[numbers.length - 1]);
              } else {
                val = 0;
              }
            }
          }

          if (dbCol === "beDate") {
            val = parseDateValue(val);
          }

          mappedRow[dbCol] = val;
        }
      }

      // Auto-extract item description from Excel columns if itemName wasn't explicitly mapped or is empty
      if (!mappedRow.itemName || String(mappedRow.itemName).trim() === "") {
        const descKey = Object.keys(row).find((k) => {
          const cleanK = k.trim().toLowerCase().replace(/[\s\.\_\-\/]+/g, "");
          return (
            cleanK.includes("description") ||
            cleanK.includes("goodsdesc") ||
            cleanK.includes("itemdesc") ||
            cleanK.includes("commodity") ||
            cleanK.includes("commercialdesc") ||
            cleanK.includes("itemname") ||
            cleanK === "goods" ||
            cleanK === "desc"
          );
        });
        if (descKey && row[descKey] !== undefined && row[descKey] !== null && String(row[descKey]).trim() !== "") {
          mappedRow.itemName = String(row[descKey]).trim();
        }
      }

      if (Object.keys(mappedRow).length === 0) continue;
      if (!mappedRow.beNo || !mappedRow.hsCode) continue;

      // Extract and normalize numeric fields
      const netWt = round2(parseNumber(mappedRow.netWt));
      const excessQty = round2(parseNumber(mappedRow.excessQty));
      const totalQty = round2(netWt + excessQty);
      const assValue = round2(parseNumber(mappedRow.assValue));
      const cd = round2(parseNumber(mappedRow.cd));
      const rd = round2(parseNumber(mappedRow.rd));
      const sd = round2(parseNumber(mappedRow.sd));
      const baseValueOfVat = round2(assValue + cd + rd + sd);
      const unitValue = round2(totalQty > 0 ? baseValueOfVat / totalQty : 0);
      const vat = mappedRow.vat !== undefined ? round2(parseNumber(mappedRow.vat)) : 0;
      const at = mappedRow.at !== undefined ? round2(parseNumber(mappedRow.at)) : 0;

      const rawHs = String(mappedRow.hsCode).trim();
      mappedRow.awHsCode = rawHs.replace(/[\.\s]/g, "");
      mappedRow.hsCode = formatStandardHsCode(rawHs);

      mappedRow.netWt = netWt;
      mappedRow.excessQty = excessQty;
      mappedRow.totalQty = totalQty;
      mappedRow.assValue = assValue;
      mappedRow.cd = cd;
      mappedRow.rd = rd;
      mappedRow.sd = sd;
      mappedRow.baseValueOfVat = baseValueOfVat;
      mappedRow.unitValue = unitValue;
      mappedRow.vat = vat;
      mappedRow.at = at;
      mappedRow.month = month || (mappedRow.beDate ? mappedRow.beDate.slice(0, 7) : "");
      mappedRow.isRebate = isRebate;
      mappedRow.isFfs = isFfs;
      mappedRow.tempId = `temp_${Math.random().toString(36).substr(2, 9)}`;

      processedData.push(mappedRow);
    }

    if (processedData.length === 0) {
      return c.json(
        {
          success: false,
          message:
            "No valid rows found in the uploaded file. Please ensure Excel headers match Database Column Mappings."
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // ── HS Code & Commodity Validation ──────────────────────────────────
    const uploadedItemsMap = new Map<string, { hsCode: string; awHsCode: string; name: string }>();

    for (const row of processedData) {
      if (row.hsCode || row.awHsCode) {
        const awHsCode = String(row.awHsCode || String(row.hsCode).replace(/[\.\s]/g, "")).trim();
        const stdHsCode = formatStandardHsCode(row.hsCode || awHsCode);
        const itemName =
          row.itemName && String(row.itemName).trim() !== "" && String(row.itemName).trim() !== "Unknown Item"
            ? String(row.itemName).trim()
            : "";

        if (!uploadedItemsMap.has(awHsCode)) {
          uploadedItemsMap.set(awHsCode, {
            awHsCode,
            hsCode: stdHsCode,
            name: itemName
          });
        } else if (itemName && !uploadedItemsMap.get(awHsCode)!.name) {
          uploadedItemsMap.get(awHsCode)!.name = itemName;
        }
      }
    }

    const dbGlobalItems = await db.select().from(globalItems);
    const dbItemMap = new Map<string, typeof dbGlobalItems[0]>();
    dbGlobalItems.forEach((item) => {
      const awCode = String(item.awHsCode || item.hsCode.replace(/[\.\s]/g, "")).trim();
      if (awCode) dbItemMap.set(awCode, item);
      if (item.hsCode) dbItemMap.set(item.hsCode.trim(), item);
    });

    const missingItems: any[] = [];
    for (const [awHsCode, itemInfo] of uploadedItemsMap.entries()) {
      if (!dbItemMap.has(awHsCode)) {
        missingItems.push({
          awHsCode: itemInfo.awHsCode,
          hsCode: itemInfo.hsCode,
          name: itemInfo.name
        });
      }
    }

    if (missingItems.length > 0) {
      return c.json(
        {
          success: false,
          requiresItemMapping: true,
          message: "Some items need to be mapped to HS Codes before proceeding.",
          missingItems,
          data: processedData
        },
        HttpStatusCodes.OK
      );
    }

    // Map official item names and IDs from DB
    for (const row of processedData) {
      const awHsCode = String(row.awHsCode || String(row.hsCode).replace(/[\.\s]/g, "")).trim();
      const stdHsCode = String(row.hsCode || "").trim();
      const found = dbItemMap.get(awHsCode) || dbItemMap.get(stdHsCode);
      if (found) {
        row.itemId = found.id;
        row.hsCode = found.hsCode;
        row.awHsCode = found.awHsCode;
        if (!row.itemName || row.itemName === "Unknown Item") {
          row.itemName = found.name;
        }
      }
    }

    // ── Client Resolution & Validation ─────────────────────────────────
    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const existingClients = await db
      .select()
      .from(clients)
      .where(
        isSuperAdmin
          ? undefined
          : or(
              eq(clients.createdBy, tenantAdminId),
              sql`${clients.createdBy} IS NULL`
            )
      );

    const clientByBinMap = new Map<string, typeof existingClients[0]>();
    const clientByNameMap = new Map<string, typeof existingClients[0]>();

    existingClients.forEach((cl) => {
      if (cl.binNumber) {
        const rawBin = String(cl.binNumber).trim();
        const digits = rawBin.replace(/[^0-9]/g, "");
        clientByBinMap.set(rawBin, cl);
        if (digits) clientByBinMap.set(digits, cl);
      }
      if (cl.companyName) {
        const nameKey = cl.companyName.trim().toLowerCase().replace(/^m\/s\s+/i, "");
        clientByNameMap.set(cl.companyName.trim().toLowerCase(), cl);
        clientByNameMap.set(nameKey, cl);
      }
    });

    const unmappedBins = new Map<string, string>();

    for (const row of processedData) {
      let matchedClient: typeof existingClients[0] | undefined;

      if (row.bin) {
        const rawBin = String(row.bin).trim();
        const cleanDigits = rawBin.replace(/[^0-9]/g, "");
        matchedClient = clientByBinMap.get(rawBin) || (cleanDigits ? clientByBinMap.get(cleanDigits) : undefined);
      }

      if (!matchedClient && row.clientName) {
        const rawName = String(row.clientName).trim().toLowerCase();
        const nameKey = rawName.replace(/^m\/s\s+/i, "");
        matchedClient = clientByNameMap.get(rawName) || clientByNameMap.get(nameKey);
      }

      if (matchedClient) {
        row.clientId = matchedClient.id;
        row.clientName = matchedClient.companyName;
        if (matchedClient.binNumber) {
          row.bin = matchedClient.binNumber;
        }
      } else if (row.bin && String(row.bin).trim()) {
        const cleanDigits = String(row.bin).trim().replace(/[^0-9]/g, "");
        if (!unmappedBins.has(cleanDigits || String(row.bin).trim())) {
          unmappedBins.set(cleanDigits || String(row.bin).trim(), row.clientName || "Unknown Client");
        }
      }
    }

    if (unmappedBins.size > 0) {
      const missingClients = Array.from(unmappedBins.entries()).map(([bin, name]) => ({
        bin,
        name
      }));
      return c.json(
        {
          success: false,
          requiresClientMapping: true,
          message: "Some clients in the upload need to be verified or added.",
          missingClients,
          data: processedData
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({
      success: true,
      message: `File processed successfully. ${processedData.length} records ready for preview.`,
      data: processedData
    });
  } catch (error: any) {
    console.error("Error processing upload file:", error);
    return c.json(
      { success: false, message: error.message || "Failed to process file." },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 2. SAVE PURCHASES TO DATABASE ────────────────────────────────────

export const savePurchases: Handler = async (c: any) => {
  try {
    const { data, month, isRebate, isFfs } = await c.req.json();
    const isRebateValue = Boolean(isRebate);
    const isFfsValue = Boolean(isFfs);

    if (!data || !Array.isArray(data) || data.length === 0) {
      return c.json({ success: false, message: "No data provided to save." }, HttpStatusCodes.BAD_REQUEST);
    }
    if (!month) {
      return c.json({ success: false, message: "Month is required to save data." }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    let isSuperAdmin = false;

    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id)),
        with: { role: true }
      });
      if (currentUser) {
        isSuperAdmin = currentUser.role?.name?.toLowerCase() === "superadmin";
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    // ── Step 1: Preload Clients ──────────────────────────────────────
    const existingClients = await db
      .select()
      .from(clients)
      .where(
        isSuperAdmin
          ? undefined
          : or(
              eq(clients.createdBy, tenantAdminId),
              sql`${clients.createdBy} IS NULL`
            )
      );

    const clientByBin = new Map<string, any>();
    const clientByName = new Map<string, any>();

    existingClients.forEach((cl) => {
      if (cl.binNumber) {
        const rawBin = String(cl.binNumber).trim();
        const digits = rawBin.replace(/[^0-9]/g, "");
        clientByBin.set(rawBin, cl);
        if (digits) clientByBin.set(digits, cl);
      }
      if (cl.companyName) {
        const nameKey = cl.companyName.trim().toLowerCase().replace(/^m\/s\s+/i, "");
        clientByName.set(cl.companyName.trim().toLowerCase(), cl);
        clientByName.set(nameKey, cl);
      }
    });

    // ── Step 2: Preload Global Items ─────────────────────────────────
    const uniqueHsCodes = [
      ...new Set(
        data
          .map((r: any) =>
            r.awHsCode
              ? String(r.awHsCode).trim()
              : r.hsCode
              ? String(r.hsCode).trim().replace(/[.\s]/g, "")
              : null
          )
          .filter(Boolean)
      )
    ] as string[];

    const existingItems = await db.select().from(globalItems);

    const itemByHsCode = new Map<string, any>();
    existingItems.forEach((item) => {
      const awCode = String(item.awHsCode || item.hsCode.replace(/[\.\s]/g, "")).trim();
      if (awCode) itemByHsCode.set(awCode, item);
      if (item.hsCode) itemByHsCode.set(item.hsCode.trim(), item);
    });

    // ── Step 3: Preload existing purchases for duplicate check ────────
    const existingPurchases = await db
      .select({
        id: purchases.id,
        beNo: purchases.beNo,
        beDate: purchases.beDate,
        itemId: purchases.itemId,
        clientId: purchases.clientId,
        office: purchases.office,
        totalQty: purchases.totalQty,
        netWt: purchases.netWt,
        excessQty: purchases.excessQty,
        baseValueOfVat: purchases.baseValueOfVat,
        vat: purchases.vat,
        at: purchases.at,
        clientName: clients.companyName,
        clientBin: clients.binNumber,
        itemName: globalItems.name,
        hsCode: globalItems.hsCode
      })
      .from(purchases)
      .leftJoin(clients, eq(purchases.clientId, clients.id))
      .leftJoin(globalItems, eq(purchases.itemId, globalItems.id))
      .where(isSuperAdmin ? undefined : eq(purchases.adminId, tenantAdminId));

    const existingKeys = new Set(
      existingPurchases.map((p) => `${p.beNo || ""}|${p.beDate}|${p.itemId}|${(p.office || "").trim()}`)
    );

    // ── Step 4: Process Rows & Build Inserts ─────────────────────────
    const toInsert: any[] = [];
    const duplicatesList: any[] = [];
    const ffsPendingList: any[] = [];

    for (const mappedRow of data) {
      if (Object.keys(mappedRow).length === 0 || (Object.keys(mappedRow).length === 1 && mappedRow.tempId)) continue;

      let formattedDate = mappedRow.beDate ? parseDateValue(mappedRow.beDate) : new Date().toISOString().slice(0, 10);

      // Resolve client
      let clientId: number | null = mappedRow.clientId ? Number(mappedRow.clientId) : null;
      const bin = mappedRow.bin ? String(mappedRow.bin).trim() : null;
      const cleanBinDigits = bin ? bin.replace(/[^0-9]/g, "") : "";

      if (!clientId && (bin || mappedRow.clientName)) {
        const cachedClient =
          (bin ? clientByBin.get(bin) || (cleanBinDigits ? clientByBin.get(cleanBinDigits) : undefined) : undefined) ||
          (mappedRow.clientName
            ? clientByName.get(mappedRow.clientName.trim().toLowerCase()) ||
              clientByName.get(mappedRow.clientName.trim().toLowerCase().replace(/^m\/s\s+/i, ""))
            : undefined);

        if (cachedClient) {
          clientId = cachedClient.id;
        } else {
          // Create new client for tenant
          const [newClient] = await db
            .insert(clients)
            .values({
              companyName: mappedRow.clientName || "Unknown Client",
              binNumber: bin || null,
              createdBy: tenantAdminId,
              isActive: true
            })
            .returning();
          clientId = newClient.id;
          if (bin) clientByBin.set(bin, newClient);
          if (cleanBinDigits) clientByBin.set(cleanBinDigits, newClient);
        }
      }

      // Resolve item
      let itemId: number | null = mappedRow.itemId ? Number(mappedRow.itemId) : null;
      if (!itemId && (mappedRow.hsCode || mappedRow.awHsCode || mappedRow.itemName)) {
        const normalizedHsCode = String(mappedRow.awHsCode || mappedRow.hsCode || "").trim().replace(/[.\s]/g, "");
        const stdHs = formatStandardHsCode(mappedRow.hsCode || normalizedHsCode);
        const cachedItem = itemByHsCode.get(normalizedHsCode) || itemByHsCode.get(stdHs);
        if (cachedItem) {
          itemId = cachedItem.id;
        } else {
          const [newItem] = await db
            .insert(globalItems)
            .values({
              name: mappedRow.itemName || "Unknown Item",
              hsCode: stdHs || "0000.00.00",
              awHsCode: normalizedHsCode,
              isActive: true
            })
            .returning();
          itemId = newItem.id;
          itemByHsCode.set(normalizedHsCode, newItem);
          itemByHsCode.set(stdHs, newItem);
        }
      }

      if (!clientId || !itemId) continue;

      const netWt = round2(parseNumber(mappedRow.netWt));
      const excessQty = round2(parseNumber(mappedRow.excessQty));
      const totalQty = round2(netWt + excessQty);
      const assValue = round2(parseNumber(mappedRow.assValue));
      const cd = round2(parseNumber(mappedRow.cd));
      const rd = round2(parseNumber(mappedRow.rd));
      const sd = round2(parseNumber(mappedRow.sd));
      const baseValueOfVat = round2(assValue + cd + rd + sd);
      const unitValue = round2(totalQty > 0 ? baseValueOfVat / totalQty : 0);
      const vat = round2(parseNumber(mappedRow.vat));
      const at = round2(parseNumber(mappedRow.at));
      const office = (mappedRow.office?.toString() || "").trim();
      const beNo = (mappedRow.beNo?.toString() || "").trim();

      const dedupKey = `${beNo}|${formattedDate}|${itemId}|${office}`;

      // Pre-July FFS check
      const parsedDate = new Date(formattedDate);
      if (isFfsValue && parsedDate < new Date("2025-07-01T00:00:00")) {
        ffsPendingList.push({
          ...mappedRow,
          clientId,
          itemId,
          office,
          beNo,
          beDate: formattedDate,
          month,
          netWt,
          excessQty,
          totalQty,
          assValue,
          unitValue,
          cd,
          rd,
          sd,
          baseValueOfVat,
          vat,
          at,
          isRebate: isRebateValue,
          isFfs: isFfsValue
        });
        continue;
      }

      if (existingKeys.has(dedupKey)) {
        const existing = existingPurchases.find(
          (p) =>
            p.beNo === beNo &&
            String(p.beDate) === formattedDate &&
            p.itemId === itemId &&
            (p.office || "").trim() === office
        );
        const incomingData = {
          ...mappedRow,
          clientId,
          itemId,
          office,
          beNo,
          beDate: formattedDate,
          month,
          netWt,
          excessQty,
          totalQty,
          assValue,
          unitValue,
          cd,
          rd,
          sd,
          baseValueOfVat,
          vat,
          at,
          isRebate: isRebateValue,
          isFfs: isFfsValue
        };
        duplicatesList.push({
          existing: existing || {},
          incoming: incomingData,
          newData: incomingData
        });
        continue;
      }

      toInsert.push({
        adminId: tenantAdminId,
        clientId,
        itemId,
        office,
        beNo,
        beDate: formattedDate,
        month,
        lcNumber: mappedRow.lcNumber ? String(mappedRow.lcNumber).trim() : null,
        netWt,
        excessQty,
        totalQty,
        assValue,
        unitValue,
        cd,
        rd,
        sd,
        baseValueOfVat,
        vat,
        at,
        isRebate: isRebateValue,
        isFfs: isFfsValue
      });
    }

    if (toInsert.length > 0) {
      await db.insert(purchases).values(toInsert);
    }

    return c.json({
      success: true,
      message: `${toInsert.length} records saved to database successfully!`,
      totalRowsProcessed: toInsert.length,
      duplicatesList,
      ffsPendingList
    });
  } catch (error: any) {
    console.error("Error saving purchases:", error);
    return c.json(
      { success: false, message: error.message || "Failed to save purchases" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 3. REPLACE DUPLICATE PURCHASE RECORD ─────────────────────────────

export const replaceDuplicate: Handler = async (c: any) => {
  try {
    const { itemsToReplace } = await c.req.json();
    if (!itemsToReplace || !Array.isArray(itemsToReplace) || itemsToReplace.length === 0) {
      return c.json({ success: false, message: "No items provided for replacement." }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id))
      });
      if (currentUser) {
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    for (const item of itemsToReplace) {
      const target = item.incoming || item.newData || item;
      const beNo = target.beNo;
      const beDate = target.beDate;
      const itemId = target.itemId;
      const office = target.office;

      if (beNo && beDate && itemId) {
        await db
          .delete(purchases)
          .where(
            and(
              eq(purchases.adminId, tenantAdminId),
              eq(purchases.beNo, beNo),
              eq(purchases.beDate, beDate),
              eq(purchases.itemId, itemId)
            )
          );

        await db.insert(purchases).values({
          adminId: tenantAdminId,
          clientId: target.clientId,
          itemId: target.itemId,
          office: target.office,
          beNo: target.beNo,
          beDate: target.beDate,
          month: target.month,
          lcNumber: target.lcNumber || null,
          netWt: parseNumber(target.netWt),
          excessQty: parseNumber(target.excessQty),
          totalQty: parseNumber(target.totalQty),
          assValue: parseNumber(target.assValue),
          unitValue: parseNumber(target.unitValue),
          cd: parseNumber(target.cd),
          rd: parseNumber(target.rd),
          sd: parseNumber(target.sd),
          baseValueOfVat: parseNumber(target.baseValueOfVat),
          vat: parseNumber(target.vat),
          at: parseNumber(target.at),
          isRebate: Boolean(target.isRebate),
          isFfs: Boolean(target.isFfs)
        });
      }
    }

    return c.json({ success: true, message: "Duplicate record replaced successfully" });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to replace record" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// ── 4. SAVE PENDING FFS PURCHASES ─────────────────────────────────────

export const savePendingFfs: Handler = async (c: any) => {
  try {
    const { itemsToSave, takeRebate } = await c.req.json();
    if (!itemsToSave || !Array.isArray(itemsToSave) || itemsToSave.length === 0) {
      return c.json({ success: false, message: "No FFS items provided." }, HttpStatusCodes.BAD_REQUEST);
    }

    const auth = c.get("auth") || c.get("user");
    let tenantAdminId = 1;
    if (auth?.id) {
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, Number(auth.id))
      });
      if (currentUser) {
        tenantAdminId = currentUser.adminId ? Number(currentUser.adminId) : currentUser.id;
      }
    }

    const toInsert = itemsToSave.map((item: any) => ({
      adminId: tenantAdminId,
      clientId: item.clientId,
      itemId: item.itemId,
      office: item.office,
      beNo: item.beNo,
      beDate: item.beDate,
      month: item.month,
      lcNumber: item.lcNumber || null,
      netWt: parseNumber(item.netWt),
      excessQty: parseNumber(item.excessQty),
      totalQty: parseNumber(item.totalQty),
      assValue: parseNumber(item.assValue),
      unitValue: parseNumber(item.unitValue),
      cd: parseNumber(item.cd),
      rd: parseNumber(item.rd),
      sd: parseNumber(item.sd),
      baseValueOfVat: parseNumber(item.baseValueOfVat),
      vat: parseNumber(item.vat),
      at: parseNumber(item.at),
      isRebate: Boolean(takeRebate),
      isFfs: true
    }));

    await db.insert(purchases).values(toInsert);

    return c.json({ success: true, message: `${toInsert.length} FFS records saved successfully!` });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message || "Failed to save FFS items" },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
