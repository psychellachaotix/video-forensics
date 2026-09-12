import {
  bigint,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const videosTable = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    fileHash: text("file_hash").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    uploadTimestamp: timestamp("upload_timestamp", {
      withTimezone: true,
    }).notNull().defaultNow(),
    originalPath: text("original_path"),
    mediaType: text("media_type").notNull().default("video"),
    status: text("status").notNull().default("NAHRANO"),
  },
  (table) => [
    uniqueIndex("videos_file_hash_unique").on(table.fileHash),
    index("idx_videos_hash").on(table.fileHash),
  ],
);

export const insertVideoSchema = createInsertSchema(videosTable).omit({
  id: true,
  uploadTimestamp: true,
});
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
