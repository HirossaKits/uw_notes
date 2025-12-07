import { crateEmbedding } from "@/llm/embedding";
import { AnalyzeResultOutput } from "@azure-rest/ai-document-intelligence";
import OpenAI from "openai";

type Chunk = {
  text: string;
  startOffset: number;
  endOffset: number;
  startPage: number;
  endPage: number;
  bboxStart: number[];
  bboxEnd: number[];
};

export type EmbeddedChunk = {
  text: string;
  embedding: number[];
  metadata: {
    startPage: number;
    endPage: number;
    bboxStart: number[];
    bboxEnd: number[];
    textStartOffset: number;
    textEndOffset: number;
  };
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
      startPage: bounding?.pageNumber || 1,
      endPage: bounding?.pageNumber || 1,
      bboxStart: bounding?.polygon || [],
      bboxEnd: bounding?.polygon || [],
    };
  });
}

export async function embedChunks(client: OpenAI, chunks: Chunk[]): Promise<EmbeddedChunk[]> {
  const embedded: EmbeddedChunk[] = [];

  for (const c of chunks) {
    const embedding = await crateEmbedding(c.text); 

    embedded.push({
      text: c.text,
      embedding: embedding,
      metadata: {
        startPage: c.startPage,
        endPage: c.endPage,
        bboxStart: c.bboxStart,
        bboxEnd: c.bboxEnd,
        textStartOffset: c.startOffset,
        textEndOffset: c.endOffset,
      },
    });
  }

  return embedded;
}