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
    console.log(query)
    console.log(queryResults)
    const filteredResults = queryResults.filter((r) => r.similarity >= similarityThreshold);

    const metaList = filteredResults.map((r) => JSON.parse(r.meta) as MetaData);
    console.log(metaList)

    for (const meta of metaList) {
      // Process each bounding region (each page)
      for (const region of meta.boundingRegions) {
        // region.polygon is already a bounding box [minX, minY, maxX, maxY]
        // Convert to BoundingBox format {left, top, right, bottom}
        const boundingBox = {
          left: region.polygon[0],
          top: region.polygon[1],
          right: region.polygon[2],
          bottom: region.polygon[3],
        };
        const png = await clipPngFromPdf(
          path.join(PATHS.PDF.CHUNK, path.basename(meta.source, path.extname(meta.source)) + '.pdf'), 
          region.page, 
          boundingBox, 
          path.join(PATHS.questionImages(dir), `reference_page${region.page}_${meta.heading}.png`)
        );
      }
    }
  }
}

clipPdf().catch(console.error);