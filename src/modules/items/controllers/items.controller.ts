import { asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { globalItems } from "@/modules/superadmin/database/models/global_items.js";

export function formatStandardHsCode(code: string | null | undefined): string {
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

export const getItems: Handler = async (c: any) => {
  try {
    const list = await db.select().from(globalItems).orderBy(asc(globalItems.hsCode));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const bulkCreateItems: Handler = async (c: any) => {
  try {
    const { items: newItems } = await c.req.json();
    if (!newItems || !Array.isArray(newItems) || newItems.length === 0) {
      return c.json({ success: false, message: "No items provided." }, HttpStatusCodes.BAD_REQUEST);
    }

    const inserted: any[] = [];
    for (const item of newItems) {
      const rawInput = (item.hsCode || item.awHsCode || "").trim();
      const rawAw = (item.awHsCode || rawInput.replace(/[\.\s]/g, "")).trim();
      const standardHs = formatStandardHsCode(item.hsCode || rawAw);
      const name = (item.name || "").trim() || "Unknown Item";
      const unit = (item.unit || "U").trim();

      if (rawAw || standardHs) {
        // Look up by awHsCode or standard hsCode or raw hsCode
        const existing = await db
          .select()
          .from(globalItems)
          .where(
            or(
              eq(globalItems.awHsCode, rawAw),
              eq(globalItems.hsCode, standardHs),
              eq(globalItems.hsCode, rawAw)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const [updated] = await db
            .update(globalItems)
            .set({
              name,
              hsCode: standardHs,
              awHsCode: rawAw,
              unit: unit || existing[0].unit,
              isActive: true,
              updatedAt: new Date()
            })
            .where(eq(globalItems.id, existing[0].id))
            .returning();
          inserted.push(updated);
        } else {
          const [created] = await db
            .insert(globalItems)
            .values({
              hsCode: standardHs,
              awHsCode: rawAw,
              name,
              unit,
              isActive: true
            })
            .returning();
          inserted.push(created);
        }
      }
    }

    return c.json({
      success: true,
      message: `${inserted.length} item(s) mapped and saved successfully.`,
      data: inserted
    });
  } catch (err: any) {
    console.error("Error bulk creating items:", err);
    return c.json({ success: false, message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
