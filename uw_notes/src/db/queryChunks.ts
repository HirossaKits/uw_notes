import Database from "better-sqlite3";

export function queryChunks(db: Database, embedding: number[], limit = 5) {
  
  const stmt = db.prepare(`
    SELECT *, 
      dot_product(embedding, json(?)) as score
    FROM chunks
    ORDER BY score DESC
    LIMIT ?
  `);

  return stmt.all(JSON.stringify(embedding), limit);
}
