import * as path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { analyzePdf } from '../pdf/analyzePdf';
import { createChunksFromLayout, embedChunks } from '../index/processChunks';
import { database } from '@/db/database';
import { saveChunks } from '@/db/saveChunks';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

async function indexPdf() {
  const pdfPath = path.join(process.cwd(), 'public', 'usml_2024_2.pdf');
  
  console.log('📄 Analyzing PDF...');
  const result = await analyzePdf(pdfPath);

  console.log('✂️  Creating chunks...');
  const chunks = createChunksFromLayout(result);

  console.log('✨ Embedding chunks...');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const embedded = await embedChunks(client, chunks);

  console.log('💾 Saving chunks...');
  saveChunks(database, embedded, pdfPath);
}

indexPdf().catch(console.error);
