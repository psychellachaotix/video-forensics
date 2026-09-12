import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiAnalysisTable } from "./ai-analysis";

export const costLogTable = pgTable(
  "cost_log",
  {
    id: serial("id").primaryKey(),
    aiAnalysisId: integer("ai_analysis_id")
      .notNull()
      .references(() => aiAnalysisTable.id, { onDelete: "cascade" }),
    agentType: text("agent_type").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", {
      precision: 12,
      scale: 6,
      mode: "number",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_cost_log_analysis").on(table.aiAnalysisId)],
);

export const insertCostLogSchema = createInsertSchema(costLogTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCostLog = z.infer<typeof insertCostLogSchema>;
export type CostLog = typeof costLogTable.$inferSelect;
