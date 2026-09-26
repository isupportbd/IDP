import type { Context } from "hono";
import { db } from "@/framework/database/connection.js";
import { purchases } from "@/modules/clients/database/models/purchases.js";
import { salesRates } from "@/modules/clients/database/models/sales_rates.js";
import { clients } from "@/modules/clients/database/models/clients.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";
import { unitConversions } from "@/modules/superadmin/database/models/unit_conversions.js";
import { vatNotes } from "@/modules/superadmin/database/models/vat_notes.js";
import { eq, and, sql } from "drizzle-orm";

// GET /api/reports/monthly-summary
export const getMonthlySummary = async (c: Context) => {
  try {
    const month = c.req.query("month");
    if (!month) {
      return c.json({ success: false, message: "month is required" }, 400);
    }

    const rawSql = sql`
      SELECT 
        c.id as "clientId",
        COALESCE(c.company_name, c.name) as "clientName",
        c.bin_number as "clientBin",
        SUM(COALESCE(p.net_wt, 0)) as "totalNetWt"
      FROM clients c
      INNER JOIN purchases p ON c.id = p.client_id
      WHERE p.month = ${month}
      GROUP BY c.id, c.company_name, c.name, c.bin_number
      ORDER BY "clientName" ASC
    `;

    const result: any = await db.execute(rawSql);
    const rows = result.rows || result || [];

    const data = rows.map((row: any) => ({
      clientId: row.clientId,
      clientName: row.clientName,
      clientBin: row.clientBin || "",
      totalNetWt: Number(row.totalNetWt) || 0
    }));

    return c.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching monthly summary:", error);
    return c.json({ success: false, message: "Failed to fetch monthly summary" }, 500);
  }
};

// GET /api/reports/sales
export const getSalesReport = async (c: Context) => {
  try {
    const clientId = c.req.query("clientId");
    const month = c.req.query("month");
    const itemId = c.req.query("itemId");

    if (!clientId || !month) {
      return c.json({ success: false, message: "clientId and month are required" }, 400);
    }

    const [yearStr, monthStr] = month.split("-");
    const reportMonthEnd = new Date(parseInt(yearStr), parseInt(monthStr), 0);
    const reportMonthEndStr = `${reportMonthEnd.getFullYear()}-${String(reportMonthEnd.getMonth() + 1).padStart(2, "0")}-${String(reportMonthEnd.getDate()).padStart(2, "0")}`;

    const rawSql = sql`
      SELECT 
        p.item_id as "itemId",
        COALESCE(i.name, 'Item') as "itemName",
        COALESCE(i.hs_code, '') as "hsCode",
        p.is_ffs as "isFfs",
        p.is_rebate as "isRebate",
        SUM(COALESCE(p.total_qty, 0)) as "totalQty",
        SUM(COALESCE(p.net_wt, 0)) as "netWt",
        SUM(COALESCE(p.base_value_of_vat, 0)) as "totalBaseValueOfVat",
        SUM(COALESCE(p.total_qty, 0) * COALESCE(sr.sales_rate, 0) * COALESCE(uc.factor, 1)) as "totalSalesRateValue",
        SUM(COALESCE(p.total_qty, 0) * COALESCE(sr.vatable_value, 0) * COALESCE(uc.factor, 1)) as "totalValue",
        MAX(COALESCE(sr.vat_rate, 0)) as "vatRate"
      FROM purchases p
      LEFT JOIN global_items i ON p.item_id = i.id
      LEFT JOIN LATERAL (
        SELECT r.vatable_value, r.sales_rate, r.vat_rate, r.unit_id
        FROM sales_rates r
        WHERE r.item_id = p.item_id
          AND r.client_id = p.client_id
          AND r.status = 'Active'
          AND (r.activation_date <= GREATEST(p.be_date, TO_DATE(p.month || '-01', 'YYYY-MM-DD')) OR r.activation_date <= ${reportMonthEndStr})
        ORDER BY 
          CASE WHEN r.activation_date <= GREATEST(p.be_date, TO_DATE(p.month || '-01', 'YYYY-MM-DD')) THEN 0 ELSE 1 END ASC,
          r.activation_date DESC
        LIMIT 1
      ) sr ON true
      LEFT JOIN unit_conversions uc ON sr.unit_id = uc.id
      WHERE p.client_id = ${parseInt(clientId)}
        AND p.month = ${month}
        ${itemId ? sql`AND p.item_id = ${parseInt(itemId)}` : sql``}
      GROUP BY p.item_id, i.name, i.hs_code, p.is_ffs, p.is_rebate
    `;

    const result: any = await db.execute(rawSql);
    const rows = result.rows || result || [];
    const allVatNotes = await db.select().from(vatNotes);

    const reportItems = rows.map((row: any) => {
      const totQty = Number(row.totalQty) || 0;
      const totVal = Number(row.totalValue) || 0;
      const totSalesVal = Number(row.totalSalesRateValue) || 0;
      const totBaseVal = Number(row.totalBaseValueOfVat) || 0;

      const avgVatableValue = totQty > 0 ? totVal / totQty : 0;
      const avgSalesRate = totQty > 0 ? totSalesVal / totQty : 0;
      const avgPurchaseUnitValue = totQty > 0 ? totBaseVal / totQty : 0;

      let additionPercent = 0;
      if (avgPurchaseUnitValue > 0) {
        additionPercent = ((avgVatableValue - avgPurchaseUnitValue) / avgPurchaseUnitValue) * 100;
      }

      let vatRate = Number(row.vatRate);
      let note = "8";

      const isRebate = row.isRebate === true || row.isRebate === 1 || String(row.isRebate).toLowerCase() === "true" || String(row.isRebate) === "1";
      const isFfs = row.isFfs === true || row.isFfs === 1 || String(row.isFfs).toLowerCase() === "true" || String(row.isFfs) === "1";

      if (isRebate && !isFfs) {
        vatRate = 15;
        note = "4";
      } else {
        const mapping = allVatNotes.find((v: any) => Number(v.rate) === vatRate);
        if (mapping) {
          note = mapping.noteNumber ? String(mapping.noteNumber) : "8";
        } else {
          note = vatRate === 0 ? "3" : "8";
        }
      }

      return {
        itemId: row.itemId,
        itemName: row.itemName || "Item",
        hsCode: row.hsCode || "",
        totalQty: totQty,
        rate: avgSalesRate,
        unitValue: avgVatableValue,
        totalValue: totVal,
        addition: additionPercent,
        vatRate,
        note,
        isFfs: Boolean(row.isFfs)
      };
    });

    return c.json({ success: true, data: reportItems });
  } catch (error: any) {
    console.error("Error fetching sales report:", error);
    return c.json({ success: false, message: "Failed to generate sales report" }, 500);
  }
};

// GET /api/reports/statement
export const getStatementReport = async (c: Context) => {
  try {
    const clientId = c.req.query("clientId");
    const month = c.req.query("month");

    if (!clientId || !month) {
      return c.json({ success: false, message: "clientId and month are required" }, 400);
    }

    const purchaseData = await db
      .select({
        id: purchases.id,
        beDate: purchases.beDate,
        itemId: purchases.itemId,
        itemName: globalItems.name,
        hsCode: globalItems.hsCode,
        totalQty: purchases.totalQty
      })
      .from(purchases)
      .leftJoin(globalItems, eq(purchases.itemId, globalItems.id))
      .where(and(eq(purchases.clientId, parseInt(clientId)), eq(purchases.month, month)));

    const purchasesByItemAndDate: Record<number, Record<string, number>> = {};
    for (const p of purchaseData) {
      if (!p.itemId) continue;
      if (!purchasesByItemAndDate[p.itemId]) {
        purchasesByItemAndDate[p.itemId] = {};
      }
      const bDate = p.beDate ? String(p.beDate).slice(0, 10) : `${month}-01`;
      if (!purchasesByItemAndDate[p.itemId][bDate]) {
        purchasesByItemAndDate[p.itemId][bDate] = 0;
      }
      purchasesByItemAndDate[p.itemId][bDate] += Number(p.totalQty) || 0;
    }

    const [year, monthNum] = month.split("-");
    const lastDayOfMonth = new Date(parseInt(year), parseInt(monthNum), 0);
    const endOfMonthStr = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`;

    const ratesData = await db
      .select({
        itemId: salesRates.itemId,
        salesRate: salesRates.salesRate,
        vatRate: salesRates.vatRate,
        vatableValue: salesRates.vatableValue,
        activationDate: salesRates.activationDate,
        factor: unitConversions.factor
      })
      .from(salesRates)
      .leftJoin(unitConversions, eq(salesRates.unitId, unitConversions.id))
      .where(eq(salesRates.clientId, parseInt(clientId)))
      .orderBy(salesRates.itemId, salesRates.activationDate);

    const ratesByItem: Record<number, any[]> = {};
    for (const r of ratesData) {
      if (!ratesByItem[r.itemId]) {
        ratesByItem[r.itemId] = [];
      }
      ratesByItem[r.itemId].push(r);
    }

    const allVatNotes = await db.select().from(vatNotes);
    const statementRows: any[] = [];

    const parseDate = (rawStr: any) => {
      if (!rawStr) return 0;
      const d = new Date(rawStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    for (const itemIdStr of Object.keys(purchasesByItemAndDate)) {
      const itemId = parseInt(itemIdStr);
      const datesObj = purchasesByItemAndDate[itemId];
      const itemRates = ratesByItem[itemId] || [];

      const monthStartStr = `${month}-01`;
      let currentStartDate = monthStartStr;
      const mStartTimestamp = parseDate(monthStartStr);
      const mEndTimestamp = parseDate(endOfMonthStr);

      let baseRate = itemRates.filter((r) => parseDate(r.activationDate) <= mStartTimestamp).pop();
      const monthRates = itemRates.filter(
        (r) => parseDate(r.activationDate) > mStartTimestamp && parseDate(r.activationDate) <= mEndTimestamp
      );

      const ranges: { startDate: string; endDate: string; rate: any }[] = [];

      for (const mr of monthRates) {
        const prevEnd = new Date(parseDate(mr.activationDate));
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevEndStr = prevEnd.toISOString().split("T")[0];

        ranges.push({
          startDate: currentStartDate,
          endDate: prevEndStr,
          rate: baseRate
        });

        currentStartDate = mr.activationDate;
        baseRate = mr;
      }

      ranges.push({
        startDate: currentStartDate,
        endDate: endOfMonthStr,
        rate: baseRate
      });

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        let totalQty = 0;
        const rangeStart = parseDate(range.startDate);
        const rangeEnd = parseDate(range.endDate);

        for (const [beDate, qty] of Object.entries(datesObj)) {
          const bDate = parseDate(beDate);
          if (i === 0) {
            if (bDate <= rangeEnd) {
              totalQty += qty;
            }
          } else {
            if (bDate > rangeStart && bDate <= rangeEnd) {
              totalQty += qty;
            }
          }
        }

        if (totalQty > 0) {
          const rateObj = range.rate;
          const factor = rateObj ? Number(rateObj.factor) || 1 : 1;
          const salesRateVal = rateObj ? Number(rateObj.salesRate) * factor : 0;
          const vatRateVal = rateObj ? Number(rateObj.vatRate) : 0;
          const vatableValueVal = rateObj ? Number(rateObj.vatableValue) * factor : 0;

          const totalSalesValue = totalQty * salesRateVal;
          const totalVatableValue = totalQty * vatableValueVal;
          const totalVat = (totalVatableValue * vatRateVal) / 100;

          const itemName = purchaseData.find((p) => p.itemId === itemId)?.itemName;

          let note = "8";
          const mapping = allVatNotes.find((v: any) => Number(v.rate) === vatRateVal);
          if (mapping) {
            note = mapping.noteNumber ? String(mapping.noteNumber) : "8";
          } else if (vatRateVal === 0) {
            note = "3";
          }

          statementRows.push({
            itemId,
            itemName,
            startDate: range.startDate,
            endDate: range.endDate,
            qty: totalQty,
            salesRate: salesRateVal,
            totalSalesValue,
            vatRate: vatRateVal,
            vatableValue: totalVatableValue,
            vat: totalVat,
            note
          });
        }
      }
    }

    statementRows.sort((a, b) => {
      if (a.itemName !== b.itemName) return (a.itemName || "").localeCompare(b.itemName || "");
      return a.startDate.localeCompare(b.startDate);
    });

    return c.json({ success: true, data: statementRows });
  } catch (error) {
    console.error("Error generating statement:", error);
    return c.json({ success: false, message: "Failed to generate statement" }, 500);
  }
};
