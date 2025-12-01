import Database from "better-sqlite3";

export function queryChunks(db: Database, embedding: number[], limit = 5) {
  
  const stmt = db.prepare(`
    SELECT *, 
      1 - vec_distance_cosine(embedding, ?) as score
    FROM chunks
    ORDER BY score DESC
    LIMIT ?
  `);

  return stmt.all(embedding, limit);
}
