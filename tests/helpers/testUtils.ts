import type { Chunk } from '@/index/processChunks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalyzeResultOutput } from '@azure-rest/ai-document-intelligence';
import { expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const expectChunkStructure = (chunk: Chunk) => {
  expect(chunk).toHaveProperty('heading');
  expect(chunk).toHaveProperty('text');
  expect(chunk).toHaveProperty('startOffset');
  expect(chunk).toHaveProperty('endOffset');
  expect(chunk).toHaveProperty('boundingRegions');
  expect(Array.isArray(chunk.boundingRegions)).toBe(true);

  for (const region of chunk.boundingRegions) {
    expect(region).toHaveProperty('page');
    expect(region).toHaveProperty('polygon');
    expect(Array.isArray(region.polygon)).toBe(true);
    expect(region.polygon.length).toBe(4); // [minX, minY, maxX, maxY]
  }
};

export const expectSpanStructure = (span: { offset: number; length: number }) => {
  expect(span).toHaveProperty('offset');
  expect(span).toHaveProperty('length');
  expect(typeof span.offset).toBe('number');
  expect(typeof span.length).toBe('number');
  expect(span.offset).toBeGreaterThanOrEqual(0);
  expect(span.length).toBeGreaterThanOrEqual(0);
};

export const getAnalyzeResultMockFromJson = () => {
  const jsonPath = path.join(__dirname, '../fixtures/mock_data.json');
  const json = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(json) as AnalyzeResultOutput;
};
