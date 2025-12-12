import { createEmbedding } from "@/llm/embedding";
import { AnalyzeResultOutput } from "@azure-rest/ai-document-intelligence";
import OpenAI from "openai";

type Chunk = {
  text: string;
  startOffset: number;
  endOffset: number;
  page: number;
  polygon: number[];
};

export type MetaData = {
  page: number;
  polygon: number[];
  textStartOffset: number;
  textEndOffset: number;
};

export type EmbeddedChunk = {
  text: string;
  embedding: number[];
  metadata: MetaData;
};

export function createChunksFromLayout(result: AnalyzeResultOutput): Chunk[] {
  if (!result.paragraphs) return [];

  const paragraphs = result.paragraphs;

  return paragraphs.map((p) => {
    const span = p.spans?.[0];
    const bounding = p.boundingRegions?.[0];
    console.log(p.content);

    return {
      text: p.content,
      startOffset: span?.offset || 0,
      endOffset: (span?.offset || 0) + (span?.length || 0),
      page: bounding?.pageNumber || 1,
      polygon: bounding?.polygon || [],
    };
  });
}

export async function embedChunks(client: OpenAI, chunks: Chunk[]): Promise<EmbeddedChunk[]> {
  const embedded: EmbeddedChunk[] = [];

  for (const c of chunks) {
    const embedding = await createEmbedding(c.text); 

    embedded.push({
      text: c.text,
      embedding: embedding,
      metadata: {
        page: c.page,
        polygon: c.polygon,
        textStartOffset: c.startOffset,
        textEndOffset: c.endOffset,
      },
    });
  }

  return embedded;
}