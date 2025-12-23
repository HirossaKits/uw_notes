import * as path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { analyzePdf } from '../pdf/analyzePdf';
import { createChunksFromLayout, embedChunks } from '../index/processChunks';
import { database } from '@/db/database';
import { saveChunks } from '@/db/saveChunks';
import fs from 'node:fs';
import { AnalyzeResultOutput } from '@azure-rest/ai-document-intelligence';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

async function indexPdf() {
  const jsonPath = path.join(process.cwd(), 'public', 'usml_2024_20.json');
  const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as AnalyzeResultOutput;

  console.log('✂️  Creating chunks...');
  const chunks = createChunksFromLayout(result);

  console.log('✨ Embedding chunks...');
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const embedded = await embedChunks(client, chunks);

  console.log('💾 Saving chunks...');
  saveChunks(database, embedded, jsonPath);
}

indexPdf().catch(console.error);
