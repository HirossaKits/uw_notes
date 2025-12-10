import * as fs from 'node:fs';
import * as path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { analyzePdf } from '../pdf/analyzePdf';
import { createChunksFromLayout, embedChunks } from '../index/processChunks';
import { extractPngFromPdf } from '../pdf/extractPdf';
import { createDatabase } from '@/db/createDatabase';
import { saveChunks } from '@/db/saveChunks';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

async function main() {
  const pdfPath = path.join(process.cwd(), 'public', 'usml_2024_1.pdf');
  
  console.log('📄 Analyzing PDF...');
  const result = await analyzePdf(pdfPath);

  console.log('✂️  Creating chunks...');
  const chunks = createChunksFromLayout(result);

  console.log('✨ Embedding chunks...');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const embedded = await embedChunks(client, chunks);

  console.log('💾 Saving chunks...');
  const db = createDatabase()
  saveChunks(db, embedded, pdfPath);

  // chunksディレクトリを作成
  // const chunksDir = path.join(process.cwd(), 'chunks');
  // if (!fs.existsSync(chunksDir)) {
  //   fs.mkdirSync(chunksDir, { recursive: true });
  // }

  // for (const meta of embedded) {
  //   await extractPngFromPdf(
  //     pdfPath,
  //     meta.metadata.startPage,
  //     meta.metadata.bboxStart,
  //     path.join(chunksDir, `${meta.metadata.startPage}_${meta.metadata.textStartOffset}.png`)
  //   );
  // }
}

main().catch(console.error);
