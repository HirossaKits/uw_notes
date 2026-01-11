import path from "node:path";
import fs from "node:fs";
import { queryChunks } from "@/db/queryChunks";
import { database } from "@/db/database";
import { clipPngFromPdf, getBoundingBox } from "@/pdf/processPdf";
import { MetaData } from "@/index/processChunks";
import { PATHS } from "@/config/paths";

const similarityThreshold = 0.6;

export async function clipPdf() {
  const questionsRoot = PATHS.QUESTIONS;
  const questionDirs = fs.readdirSync(questionsRoot);

  for (const dir of questionDirs) {
    const questionJson = fs.readFileSync(PATHS.questionJson(dir), 'utf8');
    const question = JSON.parse(questionJson);
    const query = `
    ${question.topic}
    ${question.system}
    ${question.subject}
    ${question.explanation}
    `;
    // TODO: Optimize limit, similarity
    const queryResults = await queryChunks(database, query, 20);
    const filteredResults = queryResults.filter((r) => r.similarity >= similarityThreshold);

    const metaList = filteredResults.map((r) => JSON.parse(r.meta) as MetaData);

    for (const meta of metaList) {
      const pages = new Set(meta.boundingRegions.map((r) => r.page));

      for (const page of pages) {
        const boundingRegions = meta.boundingRegions.filter((r) => r.page === page);
        const boundingBox = getBoundingBox(boundingRegions.map((r) => r.polygon));
        await clipPngFromPdf(
          path.join(PATHS.PDF.CHUNK, path.basename(meta.source, path.extname(meta.source)) + '.pdf'), 
          page, 
          boundingBox, 
          path.join(PATHS.questionImages(dir), `reference_page${page}_${meta.heading}.png`)
        );
      }
    }
  }
}

clipPdf().catch(console.error);
