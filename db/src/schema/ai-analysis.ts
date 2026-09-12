import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videosTable } from "./videos";

export const aiAnalysisTable = pgTable(
  "ai_analysis",
  {
    id: serial("id").primaryKey(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videosTable.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull().default("v1.0"),
    interpretResultJson: jsonb("interpret_result_json"),
    interpretInputTokens: integer("interpret_input_tokens"),
    interpretOutputTokens: integer("interpret_output_tokens"),
    interpretCostUsd: numeric("interpret_cost_usd", {
      precision: 12,
      scale: 6,
      mode: "number",
    }),
    verifierResultJson: jsonb("verifier_result_json"),
    verifierInputTokens: integer("verifier_input_tokens"),
    verifierOutputTokens: integer("verifier_output_tokens"),
    verifierCostUsd: numeric("verifier_cost_usd", {
      precision: 12,
      scale: 6,
      mode: "number",
    }),
    finalniStatus: text("finalni_status"),
    manualniVerdikt: text("manualni_verdikt"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retryCount: integer("retry_count").notNull().default(0),
    apiError: text("api_error"),
  },
  (table) => [
    index("idx_ai_analysis_video").on(table.videoId),
    index("idx_ai_analysis_status").on(table.finalniStatus),
  ],
);

export const insertAiAnalysisSchema = createInsertSchema(aiAnalysisTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type AiAnalysis = typeof aiAnalysisTable.$inferSelect;
