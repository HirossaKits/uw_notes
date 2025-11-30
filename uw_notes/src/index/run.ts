import * as fs from 'node:fs';
import * as path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { analyzePdfLayout } from './analyzePdf';
import { createChunksFromLayout, embedChunks } from './embeddings';
import { extractPngFromPdf } from './clipPdf';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

async function main() {
  const pdfPath = path.join(process.cwd(), 'public', '000072734.pdf');
  
  const result = await analyzePdfLayout(pdfPath); // markdown + layout data
  const chunks = createChunksFromLayout(result); // paragraph chunks
  
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const embedded = await embedChunks(client, chunks); // store with metadata

  // chunksディレクトリを作成
  const chunksDir = path.join(process.cwd(), 'chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  for (const meta of embedded) {
    await extractPngFromPdf(
      pdfPath,
      meta.metadata.startPage,
      meta.metadata.bboxStart,
      path.join(chunksDir, `${meta.metadata.startPage}_${meta.metadata.textStartOffset}.png`)
    );
  }
}

main().catch(console.error);
