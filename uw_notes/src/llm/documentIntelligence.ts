import DocumentIntelligence, {
  AnalyzeDocumentFromStreamMediaTypesParam,
  AnalyzeResultOutput,
  DocumentContentFormat,
  getLongRunningPoller,
  isUnexpected,
  type AnalyzeOperationOutput,
} from '@azure-rest/ai-document-intelligence';
import dotenv from 'dotenv';
import { AzureKeyCredential } from '@azure/core-auth';

dotenv.config();

const AZURE_AI_DOC_ENDPOINT = process.env.AZURE_AI_DOC_ENDPOINT!;
const AZURE_AI_DOC_KEY = process.env.AZURE_AI_DOC_KEY!;

if (!AZURE_AI_DOC_ENDPOINT) throw new Error("❌ AZURE_DI_ENDPOINT not found");
if (!AZURE_AI_DOC_KEY) throw new Error("❌ AZURE_DI_KEY not found");

// Layout Model ID
const MODEL_ID = "prebuilt-layout";

const client = DocumentIntelligence(AZURE_AI_DOC_ENDPOINT, new AzureKeyCredential(AZURE_AI_DOC_KEY));

export async function analyzeDocument(data: string | Buffer,
   contentType: AnalyzeDocumentFromStreamMediaTypesParam['contentType'], 
   outputContentFormat: DocumentContentFormat): Promise<AnalyzeResultOutput> {

  // Submit document for analysis
  const initialResponse = await client
    .path('/documentModels/{modelId}:analyze', MODEL_ID)
    .post({
      contentType: contentType,
      body: data,
      queryParameters: { outputContentFormat: outputContentFormat },
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

  return result.analyzeResult;
}