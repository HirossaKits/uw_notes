import Database from "better-sqlite3";
import { EmbeddedChunk } from '@/index/processChunks';


export function saveChunks(db: Database, embedded: EmbeddedChunk[], source: string) {
  const stmt = db.prepare(`
    INSERT INTO vec_items 
    (embedding, meta)
    VALUES (?, ?)
  `);

  const insertMany = db.transaction((records: EmbeddedChunk[]) => {
    for (const r of records) {
      const embedding = Buffer.from(new Float32Array(r.embedding).buffer);

      stmt.run(
        embedding,
        JSON.stringify({text: r.text, ...r.metadata, source}),
      );
    }
  });

  insertMany(embedded);
}