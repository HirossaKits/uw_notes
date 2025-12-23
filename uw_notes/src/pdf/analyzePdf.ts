import * as fs from 'node:fs';
import DocumentIntelligence, {
  AnalyzeResultOutput,
} from '@azure-rest/ai-document-intelligence';

import { analyzeDocument } from '@/llm/documentIntelligence';
import { AzureKeyCredential } from '@azure/core-auth';
import dotenv from 'dotenv';

dotenv.config();


/**
 * Convert PDF to JSON
 * using Azure AI Document Intelligence
 */
export async function analyzePdf(pdfPath): Promise<AnalyzeResultOutput> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }
  
  const pdfData = await fs.promises.readFile(pdfPath);
  const result = await analyzeDocument(pdfData, "application/pdf", "markdown");

  return result;
}