import * as fs from 'node:fs';
import DocumentIntelligence, {
  AnalyzeResultOutput,
  getLongRunningPoller,
  isUnexpected,
  type AnalyzeOperationOutput,
} from '@azure-rest/ai-document-intelligence';
import { AzureKeyCredential } from '@azure/core-auth';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const AZURE_AI_DOC_ENDPOINT = process.env.AZURE_AI_DOC_ENDPOINT!;
const AZURE_AI_DOC_KEY = process.env.AZURE_AI_DOC_KEY!;

if (!AZURE_AI_DOC_ENDPOINT) throw new Error("❌ AZURE_DI_ENDPOINT not found");
if (!AZURE_AI_DOC_KEY) throw new Error("❌ AZURE_DI_KEY not found");

// Layout モデル ID
const MODEL_ID = "prebuilt-layout";

/**
 * Convert PDF to JSON
 * using Azure AI Document Intelligence
 */
export async function analyzePdfLayout(pdfPath: string): Promise<AnalyzeResultOutput> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const pdfData = await fs.promises.readFile(pdfPath);
  const client = DocumentIntelligence(AZURE_AI_DOC_ENDPOINT, new AzureKeyCredential(AZURE_AI_DOC_KEY));

  // Submit document for analysis
  const initialResponse = await client
    .path('/documentModels/{modelId}:analyze', MODEL_ID)
    .post({
      contentType: "application/pdf",
      body: pdfData,
    });

  if (isUnexpected(initialResponse)) {
    throw new Error(
      `Failed to submit document: ${JSON.stringify(initialResponse.body.error)}`
    );
  }

  // Poll for results
  const poller = getLongRunningPoller(client, initialResponse);
  const result = (await poller.pollUntilDone()).body as AnalyzeOperationOutput;

  if (!result.analyzeResult) {
    throw new Error('No analyze result returned');
  }

  // Return JSON result
  return result.analyzeResult;
}


async function main() {
  const pdfPath = path.join(process.cwd(), 'public', '000072734.pdf');
  const result = await analyzePdfLayout(pdfPath);
  const json = JSON.stringify(result, null, 2);
  await fs.promises.writeFile(path.join(process.cwd(), 'public', '000072734.json'), json);
}

main().catch(console.error);