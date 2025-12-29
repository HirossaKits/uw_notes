import path from "node:path";
import fs from "node:fs";
import { queryChunks } from "@/db/queryChunks";
import { database } from "@/db/database";
import { clipPngFromPdf, getBoundingBox } from "@/pdf/processPdf";
import { MetaData } from "@/index/processChunks";
import { PATHS } from "@/config/paths";

export async function clipPdf() {
  const questionsRoot = PATHS.QUESTIONS;
  const questionDirs = fs.readdirSync(questionsRoot);

  for (const dir of questionDirs) {
    const questionJson = fs.readFileSync(PATHS.questionJson(dir), 'utf8');
    const question = JSON.parse(questionJson);
    // const query = `
    // ${question.topic}
    // ${question.system}
    // ${question.subject}
    // ${question.explanation}
    // `;
    const query = "mitral valve"
    // TODO: limit, similarity の調整
    const queryResults = await queryChunks(database, query, 20);
    const meta = queryResults.map((r) => JSON.parse(r.meta))
    const res = queryResults.map((r) =>{return {similarity: r.similarity, meta:JSON.parse(r.meta)}})


    const texts = res.map((r) => `${r.meta.text}\n(similarity: ${r.similarity})`  ).join('\n\n');
    console.log(texts);

    // ページごとに分割
    const metaByPage:Record<number, MetaData[]> = meta.reduce((acc: Record<number, MetaData[]>, curr: MetaData) => {
      acc[curr.page] = acc[curr.page] || [];
      acc[curr.page].push(curr);
      return acc;
    }, {});

    for (const page of Object.keys(metaByPage)) {
      const metaList = metaByPage[page];
      const polygons = metaList.map((m) => m.polygon);
      const boundingBox = getBoundingBox(polygons);
      const png = await clipPngFromPdf(path.join(PATHS.PUBLIC, 'usml_2024_2.pdf'), parseInt(page), boundingBox, path.join(PATHS.questionImages(dir), 'reference.png'));
    }
  }
}

clipPdf().catch(console.error);