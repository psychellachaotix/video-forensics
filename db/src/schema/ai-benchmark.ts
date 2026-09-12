import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiBenchmarkSamplesTable = pgTable(
  "ai_benchmark_samples",
  {
    id: serial("id").primaryKey(),
    sampleKey: text("sample_key").notNull(),
    label: text("label").notNull(),
    expectedClass: text("expected_class").notNull(),
    sourceFamily: text("source_family").notNull(),
    mediaSha256: text("media_sha256").notNull(),
    provenanceUri: text("provenance_uri").notNull(),
    labelEvidence: text("label_evidence").notNull(),
    ambiguousCase: boolean("ambiguous_case").notNull().default(false),
    captureVersion: text("capture_version").notNull(),
    recipeJson: jsonb("recipe_json").notNull(),
    findingsJson: jsonb("findings_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_benchmark_samples_key_unique").on(table.sampleKey),
    index("idx_ai_benchmark_samples_expected").on(table.expectedClass),
  ],
);

export const aiBenchmarkRunsTable = pgTable(
  "ai_benchmark_runs",
  {
    id: serial("id").primaryKey(),
    sampleId: integer("sample_id")
      .notNull()
      .references(() => aiBenchmarkSamplesTable.id, { onDelete: "cascade" }),
    expectedClass: text("expected_class").notNull(),
    actualClass: text("actual_class").notNull(),
    confidence: integer("confidence").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    runGroup: text("run_group"),
    fixtureFingerprint: text("fixture_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_ai_benchmark_runs_prompt").on(table.promptVersion),
    index("idx_ai_benchmark_runs_sample").on(table.sampleId),
    index("idx_ai_benchmark_runs_group").on(table.runGroup),
    uniqueIndex("ai_benchmark_runs_sample_prompt_group_fixture_unique")
      .on(table.sampleId, table.promptVersion, table.runGroup, table.fixtureFingerprint),
  ],
);

export const aiBenchmarkThresholdsTable = pgTable("ai_benchmark_thresholds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  minimumOverallAccuracy: numeric("minimum_overall_accuracy", { precision: 5, scale: 4, mode: "number" }).notNull(),
  minimumMacroRecall: numeric("minimum_macro_recall", { precision: 5, scale: 4, mode: "number" }).notNull(),
  minimumPerClassRecall: numeric("minimum_per_class_recall", { precision: 5, scale: 4, mode: "number" }).notNull(),
  maximumAiFalsePositiveRate: numeric("maximum_ai_false_positive_rate", { precision: 5, scale: 4, mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiBenchmarkSampleSchema = createInsertSchema(aiBenchmarkSamplesTable).omit({ id: true, createdAt: true });
export const insertAiBenchmarkRunSchema = createInsertSchema(aiBenchmarkRunsTable).omit({ id: true, createdAt: true });
export type AiBenchmarkSample = typeof aiBenchmarkSamplesTable.$inferSelect;
export type AiBenchmarkRun = typeof aiBenchmarkRunsTable.$inferSelect;