import Database from "better-sqlite3";

export function saveChunks(db: Database, chunks: any[], source: string) {
  const stmt = db.prepare(`
    INSERT INTO chunks 
    (text, embedding, start_page, end_page, bbox_start, bbox_end, start_offset, end_offset, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records: any[]) => {
    for (const r of records) {
      stmt.run(
        r.text,
        JSON.stringify(r.embedding),
        r.startPage,
        r.endPage,
        JSON.stringify(r.bboxStart),
        JSON.stringify(r.bboxEnd),
        r.startOffset,
        r.endOffset,
        source
      );
    }
  });

  insertMany(chunks);
}
