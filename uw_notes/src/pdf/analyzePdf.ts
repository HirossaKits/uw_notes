import * as fs from 'node:fs';
import DocumentIntelligence, {
  AnalyzeResultOutput,
  getLongRunningPoller,
  isUnexpected,
  type AnalyzeOperationOutput,
} from '@azure-rest/ai-document-intelligence';


import path from 'node:path';
import { analyzeDocument } from '@/llm/documentIntelligence';



/**
 * Convert PDF to JSON
 * using Azure AI Document Intelligence
 */
export async function analyzePdf(pdfPath: string): Promise<AnalyzeResultOutput> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfData = await fs.promises.readFile(pdfPath);
  const result = await analyzeDocument(pdfData, "application/pdf", "markdown");
  return result;
}