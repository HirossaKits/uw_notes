import Database from "better-sqlite3";
import { createEmbedding } from "@/llm/embedding";

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

  const embedding = await createEmbedding(text);
  const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

  const result = await stmt.all(embeddingBlob,embeddingBlob,limit) as QueryResult[];
  return result;
}