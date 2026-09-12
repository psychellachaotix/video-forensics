import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videosTable } from "./videos";

export const rawAnalysisTable = pgTable(
  "raw_analysis",
  {
    id: serial("id").primaryKey(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videosTable.id, { onDelete: "cascade" }),
    stepName: text("step_name").notNull(),
    stepStatus: text("step_status").notNull(),
    resultJson: jsonb("result_json"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_raw_analysis_video").on(table.videoId)],
);

export const insertRawAnalysisSchema = createInsertSchema(rawAnalysisTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRawAnalysis = z.infer<typeof insertRawAnalysisSchema>;
export type RawAnalysis = typeof rawAnalysisTable.$inferSelect;
