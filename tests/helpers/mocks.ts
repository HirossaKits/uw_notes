import { vi } from 'vitest';

export const mockCreateEmbedding = vi.fn();

export const setupEmbeddingMocks = () => {
  vi.mock('@/llm/embedding', () => ({
    createEmbedding: mockCreateEmbedding,
  }));
};

export const resetMocks = () => {
  mockCreateEmbedding.mockReset();
};
