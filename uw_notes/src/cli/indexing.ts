import * as path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { analyzePdf } from '../pdf/analyzePdf';
import { createChunksFromLayout, embedChunks } from '../index/processChunks';
import { database } from '@/db/database';
import { saveChunks } from '@/db/saveChunks';
import { PATHS } from "@/config/paths";
import fs from 'node:fs';
import { AnalyzeResultOutput } from '@azure-rest/ai-document-intelligence';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

async function indexing() {
  const jsonFiles = fs.readdirSync(PATHS.JSON);

  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(PATHS.JSON, jsonFile);
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');

    const result = JSON.parse(jsonContent) as AnalyzeResultOutput;
    
    const pdfPath = path.join(PATHS.PDF.CHUNK, path.parse(jsonPath).name + '.pdf');
    if  (!fs.existsSync(pdfPath)) {
      console.log(`❌ PDF does not exist: ${pdfPath}`);
      continue;
    }

    console.log(`✂️  Creating chunks: ${jsonFile}`);
    const chunks = createChunksFromLayout(result);

    console.log(`✨ Embedding chunks: ${jsonFile}`);
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });
    const embedded = await embedChunks(client, chunks, pdfPath);

    console.log(`💾 Saving chunks: ${jsonFile}`);
    saveChunks(database, embedded, jsonFile);
  }
}

indexing().catch(console.error);
