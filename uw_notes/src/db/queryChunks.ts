import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as sqliteVec from "sqlite-vec";
import { crateEmbedding } from "@/llm/embedding";

type QueryResult = {
  similarity: number;
  meta: string;
};

export async function queryChunks(db: Database, text: string, limit = 5): Promise<QueryResult[]> {
  
  const stmt = db.prepare(`
    SELECT
      (1.0 - vec_distance_cosine(embedding, ?)) AS similarity,
      meta
    FROM vec_items
    WHERE embedding MATCH ?
    AND k = ?
    ORDER BY similarity DESC
  `);

  const embedding = await crateEmbedding(text);
  const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

  const result = await stmt.all(embeddingBlob,embeddingBlob,limit) as QueryResult[];
  return result;
}