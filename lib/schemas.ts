import { z } from "zod";
import { STOCK_UNITS, DEFAULT_STOCK_UNIT } from "@/lib/units";

/**
 * Zod schemas for every create/edit form. Forms submit FormData (all strings),
 * so numbers/dates use coercion and empty strings become undefined.
 */

/** "" / null → undefined, then optional number. */
const optNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);
/** "" / null → undefined, then optional string. */
const optStr = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().optional(),
);
/** HTML checkbox: "on"/"true"/true → true, anything else → false. */
const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === true,
  z.boolean(),
);

export const dealSchema = z.object({
  deal_id: z.string().min(1, "Deal ID is required"),
  name: z.string().min(1, "Name is required"),
  deal_type: z.enum(["production", "arbitrage"]),
  status: z.enum(["draft", "approved", "confirmed", "in_transit", "delivered", "paid"]).default("draft"),
  buyer: z.string().min(1, "Buyer is required"),
  input_product: optStr,
  output_product: optStr,
  producer: optStr,
  disport: optStr,
  tonnes: z.coerce.number().positive("Tonnes must be greater than 0"),
  buy_price_per_tonne: z.coerce.number().nonnegative("Cannot be negative"),
  sell_price_per_tonne: z.coerce.number().nonnegative("Cannot be negative"),
  shipping_per_tonne: optNum,
  trucking_per_tonne: optNum,
  payment_type: optStr,
  start_month: optStr,
  end_month: optStr,
  notes: optStr,
});
export type DealInput = z.infer<typeof dealSchema>;

export const contractSchema = z.object({
  name: z.string().min(1, "Name is required"),
  buyer: z.string().min(1, "Buyer is required"),
  price_per_tonne: z.coerce.number().nonnegative("Cannot be negative"),
  is_active: checkbox,
  status: z.string().min(1).default("active"),
  start_date: optStr,
  end_date: optStr,
  renewal_date: optStr,
  payment_terms: optStr,
  incoterm: optStr,
  auto_renew: checkbox,
  termination_notice_days: optNum,
});
export type ContractInput = z.infer<typeof contractSchema>;

export const productionPlanSchema = z.object({
  month: z.string().min(1, "Month is required"),
  target_output: z.coerce.number().nonnegative("Cannot be negative"),
  actual_output: optNum,
  b100_output: optNum,
  glycerin_output: optNum,
  uco_consumed: optNum,
  status: optStr,
  notes: optStr,
});
export type ProductionPlanInput = z.infer<typeof productionPlanSchema>;

export const stockLevelSchema = z.object({
  product: z.string().min(1, "Product is required"),
  month: z.string().min(1, "Month is required"),
  opening_stock: z.coerce.number(),
  produced: optNum,
  purchased: optNum,
  delivered: optNum,
  safety_stock_level: optNum,
  // Figures are stored in the unit they were entered in — nothing converts, so
  // the row has to say which unit it means. Defaults to the DB default.
  unit: z.enum(STOCK_UNITS).default(DEFAULT_STOCK_UNIT),
});
export type StockLevelInput = z.infer<typeof stockLevelSchema>;

export const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  deal_id: optStr,
  buyer: z.string().min(1, "Buyer is required"),
  amount_usd: z.coerce.number().nonnegative("Cannot be negative"),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  paid_date: optStr,
  status: z.string().min(1).default("draft"),
  payment_method: optStr,
  notes: optStr,
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: optStr,
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignee: optStr,
  due_date: optStr,
  link_type: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(["deal", "contract", "batch"]).optional(),
  ),
  link_id: optStr,
});
export type TaskInput = z.infer<typeof taskSchema>;

export const rawMaterialOrderSchema = z.object({
  material: z.string().min(1, "Material is required"),
  supplier: optStr,
  quantity_kg: z.coerce.number().nonnegative("Cannot be negative"),
  unit_price: optNum,
  lead_time_days: z.coerce.number().int().nonnegative("Cannot be negative"),
  order_date: optStr,
  required_by: z.string().min(1, "Required-by date is required"),
  expected_delivery: optStr,
  actual_delivery: optStr,
  status: optStr,
  linked_month: z.string().min(1, "Linked month is required"),
  auto_generated: checkbox,
  notes: optStr,
});
export type RawMaterialOrderInput = z.infer<typeof rawMaterialOrderSchema>;
