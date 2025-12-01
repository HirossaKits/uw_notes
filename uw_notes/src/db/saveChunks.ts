import Database from "better-sqlite3";
import { EmbeddedChunk } from '@/index/embeddings';

export function saveChunks(db: Database, embedded: EmbeddedChunk[], source: string) {
  const stmt = db.prepare(`
    INSERT INTO vec_items 
    (text, embedding, start_page, end_page, bbox_start, bbox_end, start_offset, end_offset, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records: EmbeddedChunk[]) => {
    for (const r of records) {
      stmt.run(
        r.text,
        JSON.stringify(r.embedding),
        // TODO: page number が NaN になるケースがあるので、根本的な解決を考える
        Number.isFinite(r.metadata.startPage) ? r.metadata.startPage : 1,
        Number.isFinite(r.metadata.endPage) ? r.metadata.endPage : 1,
        JSON.stringify(r.metadata.bboxStart),
        JSON.stringify(r.metadata.bboxEnd),
        Number.isFinite(r.metadata.textStartOffset) ? r.metadata.textStartOffset : 1,
        Number.isFinite(r.metadata.textEndOffset) ? r.metadata.textEndOffset : 1,
        source,
      );
    }
  });

  insertMany(embedded);
}
