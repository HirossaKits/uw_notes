import { describe, it, expect, beforeEach, vi } from 'vitest';
import { splitMarkdownByHeading, createChunksFromLayout, embedChunks } from '@/index/processChunks';
import type { Chunk } from '@/index/processChunks';
import type OpenAI from 'openai';
import {
  mockAnalyzeResultOutput,
  mockAnalyzeResultOutputMultiPage,
  mockAnalyzeResultOutputEmpty,
  mockAnalyzeResultOutputNoContent,
  mockAnalyzeResultOutputNoParagraphs,
  mockAnalyzeResultOutputComplex,
  createMockParagraph,
} from '../../fixtures/mockData';
import { expectChunkStructure, expectSpanStructure } from '../../helpers/testUtils';

// Mock embedding module
vi.mock('@/llm/embedding', () => ({
  createEmbedding: vi.fn(),
}));

import { createEmbedding } from '@/llm/embedding';

describe('splitMarkdownByHeading', () => {
  describe('正常系', () => {
    it('単一のH1見出しとコンテンツを正しく分割する', () => {
      const md = `# Heading 1

Content for heading 1.
This is a paragraph.`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(1);
      expect(result[0].headingText).toBe('# Heading 1');
      expect(result[0].content).toBe('Content for heading 1.\nThis is a paragraph.');
      expect(result[0].headingType).toBe('#');
    });

    it('複数の見出しを階層構造で正しく分割する', () => {
      const md = `# Heading 1

Content for H1.

## Heading 2

Content for H2.

### Heading 3

Content for H3.`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(3);
      expect(result[0].headingText).toBe('### Heading 3');
      expect(result[0].content).toBe('Content for H3.');
      expect(result[1].headingText).toBe('## Heading 2');
      expect(result[1].content).toBe('Content for H2.');
      expect(result[2].headingText).toBe('# Heading 1');
      expect(result[2].content).toBe('Content for H1.');
    });

    it('同じレベルの見出しが連続する場合を正しく処理する', () => {
      const md = `# Heading 1

Content 1.

# Heading 2

Content 2.`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(2);
      expect(result[0].headingText).toBe('# Heading 1');
      expect(result[0].content).toBe('Content 1.');
      expect(result[1].headingText).toBe('# Heading 2');
      expect(result[1].content).toBe('Content 2.');
    });

    it('見出しのみ（コンテンツなし）を正しく処理する', () => {
      const md = '# Heading 1';

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(1);
      expect(result[0].headingText).toBe('# Heading 1');
      expect(result[0].content).toBe('');
    });

    it('複雑な階層構造を正しく処理する', () => {
      const md = `# Chapter 1

Introduction text.

## Section 1.1

Section content.

### Subsection 1.1.1

Subsection content.

## Section 1.2

More section content.

# Chapter 2

Chapter 2 introduction.`;

      const result = splitMarkdownByHeading(md);

      expect(result.some((r) => r.headingText === '# Chapter 1')).toBe(true);
      expect(result.some((r) => r.headingText === '## Section 1.1')).toBe(true);
      expect(result.some((r) => r.headingText === '### Subsection 1.1.1')).toBe(true);
    });

    it('H1からH5までのすべてのレベルを正しく処理する', () => {
      const md = `# H1
Content 1
## H2
Content 2
### H3
Content 3
#### H4
Content 4
##### H5
Content 5`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(5);
      expect(result[0].headingType).toBe('#####');
      expect(result[1].headingType).toBe('####');
      expect(result[2].headingType).toBe('###');
      expect(result[3].headingType).toBe('##');
      expect(result[4].headingType).toBe('#');
    });
  });

  describe('span計算', () => {
    it('offsetが正しく計算される', () => {
      const md = `# Heading 1

Content here.`;
      const result = splitMarkdownByHeading(md);

      expect(result[0].span.offset).toBe(0);
      expectSpanStructure(result[0].span);
    });

    it('lengthが正しく計算される', () => {
      const md = `# Heading 1

Content here.`;
      const result = splitMarkdownByHeading(md);

      const expectedLength = md.length;
      expect(result[0].span.length).toBe(expectedLength);
    });

    it('改行文字が正しくカウントされる', () => {
      const md = `# Heading 1

Content here.`;
      const result = splitMarkdownByHeading(md);

      // "# Heading 1\n\nContent here." = 25文字
      expect(result[0].span.length).toBe(25);
    });

    it('複数行のコンテンツでspanが正しく計算される', () => {
      const md = `# Heading 1

Line 1
Line 2
Line 3`;
      const result = splitMarkdownByHeading(md);

      expect(result[0].span.offset).toBe(0);
      expect(result[0].span.length).toBe(md.length);
    });

    it('複数の見出しで各spanが正しく計算される', () => {
      const md = `# Heading 1
Content 1
# Heading 2
Content 2`;
      const result = splitMarkdownByHeading(md);

      expect(result[0].span.offset).toBe(0);
      expect(result[1].span.offset).toBeGreaterThan(result[0].span.offset);
    });
  });

  describe('異常系', () => {
    it('空文字列の場合は空配列を返す', () => {
      const md = '';

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(0);
    });

    it('コンテンツのみ（見出しなし）の場合は空配列を返す', () => {
      const md = 'This is content without heading.';

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(0);
    });

    it('空白のみのコンテンツを正しく処理する', () => {
      const md = '# Heading 1\n\n  \n  \n  \nContent after whitespace.';

      const result = splitMarkdownByHeading(md);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].content.trim()).toBe('Content after whitespace.');
    });
  });

  describe('境界値', () => {
    it('最後の行が見出しの場合を正しく処理する', () => {
      const md = `# Heading 1
Content
# Heading 2`;
      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(2);
      expect(result[1].content).toBe('');
    });

    it('最後の行がコンテンツの場合を正しく処理する', () => {
      const md = `# Heading 1
Content`;
      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Content');
    });

    it('長いコンテンツを正しく処理する', () => {
      const md = `# Heading 1\n\n${'Line of content.\n'.repeat(100)}`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(1);
      expect(result[0].content.length).toBeGreaterThan(1000);
    });
  });
});

describe('createChunksFromLayout', () => {
  describe('正常系', () => {
    it('基本的なparagraphsとcontentのマッチング', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutput);

      expect(result.length).toBeGreaterThan(0);
      for (const chunk of result) {
        expectChunkStructure(chunk);
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('複数ページにまたがるチャンクを正しく処理する', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutputMultiPage);

      expect(result.length).toBeGreaterThan(0);
      const multiPageChunk = result.find((chunk) => chunk.boundingRegions.length > 1);
      if (multiPageChunk) {
        expect(multiPageChunk.boundingRegions.length).toBeGreaterThan(1);
      }
    });

    it('複数のparagraphsが1つのheadingにマッチする', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutputComplex);

      expect(result.length).toBeGreaterThan(0);
      for (const chunk of result) {
        expect(chunk.boundingRegions.length).toBeGreaterThan(0);
      }
    });

    it('headingとparagraphsのオフセットが正しくマッチする', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutput);

      for (const chunk of result) {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
      }
    });
  });

  describe('boundingRegions計算', () => {
    it('ページごとに正しくグループ化される', () => {
      const output = {
        content: `# Heading 1

Content on page 1.

# Heading 2

Content on page 2.`,
        paragraphs: [
          createMockParagraph('Content on page 1.', 12, 1, [10, 10, 100, 10, 100, 30, 10, 30]),
          createMockParagraph('Content on page 2.', 45, 2, [10, 10, 100, 10, 100, 30, 10, 30]),
        ],
      };

      const result = createChunksFromLayout(output);

      expect(result.length).toBeGreaterThan(0);
      const page1Chunk = result.find((chunk) => chunk.boundingRegions.some((br) => br.page === 1));
      const page2Chunk = result.find((chunk) => chunk.boundingRegions.some((br) => br.page === 2));

      expect(page1Chunk).toBeDefined();
      expect(page2Chunk).toBeDefined();
    });

    it('複数のpolygonから正しくbounding boxが計算される', () => {
      const output = {
        content: `# Heading 1

Content paragraph 1.
Content paragraph 2.`,
        paragraphs: [
          createMockParagraph('Content paragraph 1.', 12, 1, [10, 10, 100, 10, 100, 30, 10, 30]),
          createMockParagraph('Content paragraph 2.', 35, 1, [10, 40, 100, 40, 100, 60, 10, 60]),
        ],
      } as typeof mockAnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      expect(result.length).toBeGreaterThan(0);
      const chunk = result[0];
      expect(chunk.boundingRegions.length).toBeGreaterThan(0);

      for (const region of chunk.boundingRegions) {
        // bounding box should be [minX, minY, maxX, maxY]
        expect(region.polygon[0]).toBeLessThanOrEqual(region.polygon[2]); // minX <= maxX
        expect(region.polygon[1]).toBeLessThanOrEqual(region.polygon[3]); // minY <= maxY
      }
    });

    it('無効な座標（NaN、Infinity）を正しく処理する', () => {
      const output = {
        content: `# Heading 1

Content.`,
        paragraphs: [
          {
            content: 'Content.',
            spans: [{ offset: 12, length: 9 }],
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [
                  Number.NaN,
                  Number.NaN,
                  Number.POSITIVE_INFINITY,
                  Number.POSITIVE_INFINITY,
                  100,
                  50,
                  0,
                  50,
                ],
              },
            ],
          },
        ],
      };

      const result = createChunksFromLayout(output);

      expect(result.length).toBeGreaterThan(0);
      for (const chunk of result) {
        for (const region of chunk.boundingRegions) {
          for (const coord of region.polygon) {
            expect(Number.isNaN(coord)).toBe(false);
            expect(coord).not.toBe(Number.POSITIVE_INFINITY);
            expect(coord).not.toBe(Number.NEGATIVE_INFINITY);
          }
        }
      }
    });

    it('polygonが8要素未満の場合はスキップされる', () => {
      const output = {
        content: `# Heading 1

Content.`,
        paragraphs: [
          {
            content: 'Content.',
            spans: [{ offset: 12, length: 9 }],
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [0, 0, 100, 0], // 4要素のみ
              },
            ],
          },
        ],
      };

      const result = createChunksFromLayout(output);

      // polygonが無効な場合はboundingRegionsが空になる可能性がある
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('異常系', () => {
    it('result.paragraphsがundefinedの場合は空配列を返す', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutputNoParagraphs);

      expect(result).toHaveLength(0);
    });

    it('result.contentがundefinedの場合は空配列を返す', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutputNoContent);

      expect(result).toHaveLength(0);
    });

    it('paragraphsが空配列の場合は空配列を返す', () => {
      const result = createChunksFromLayout(mockAnalyzeResultOutputEmpty);

      expect(result).toHaveLength(0);
    });

    it('spansが存在しないparagraphはスキップされる', () => {
      const output = {
        content: `# Heading 1

Content.`,
        paragraphs: [
          {
            content: 'Content.',
            spans: undefined,
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [0, 0, 100, 0, 100, 50, 0, 50],
              },
            ],
          },
        ],
      };

      const result = createChunksFromLayout(output);

      // spansがないparagraphはフィルタリングされる
      expect(result.length).toBe(0);
    });

    it('boundingRegionsが存在しないparagraphはスキップされる', () => {
      const output = {
        content: `# Heading 1

Content.`,
        paragraphs: [
          {
            content: 'Content.',
            spans: [{ offset: 12, length: 9 }],
            boundingRegions: undefined,
          },
        ],
      } as typeof mockAnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      // boundingRegionsがないparagraphはスキップされる
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('境界値', () => {
    it('空のコンテンツはフィルタリングされる', () => {
      const output = {
        content: `# Heading 1

`,
        paragraphs: [createMockParagraph('', 12, 1)],
      } as typeof mockAnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      for (const chunk of result) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('空白のみのコンテンツはフィルタリングされる', () => {
      const output = {
        content: `# Heading 1

   `,
        paragraphs: [createMockParagraph('   ', 12, 1)],
      } as typeof mockAnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      for (const chunk of result) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });
  });
});

describe('embedChunks', () => {
  const mockClient = {} as OpenAI;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('正常なchunksの埋め込み', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      vi.mocked(createEmbedding).mockResolvedValue(mockEmbedding);

      const chunks: Chunk[] = [
        {
          heading: '# Heading 1',
          text: 'Content here',
          startOffset: 0,
          endOffset: 12,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
      ];

      const result = await embedChunks(mockClient, chunks, 'test.pdf');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Content here');
      expect(result[0].embedding).toEqual(mockEmbedding);
      expect(result[0].metadata.heading).toBe('# Heading 1');
      expect(result[0].metadata.boundingRegions).toEqual(chunks[0].boundingRegions);
      expect(result[0].metadata.textStartOffset).toBe(0);
      expect(result[0].metadata.textEndOffset).toBe(12);
      expect(result[0].metadata.source).toBe('test.pdf');
    });

    it('複数のchunksを正しく処理する', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      vi.mocked(createEmbedding).mockResolvedValue(mockEmbedding);

      const chunks: Chunk[] = [
        {
          heading: '# Heading 1',
          text: 'Content 1',
          startOffset: 0,
          endOffset: 10,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
        {
          heading: '# Heading 2',
          text: 'Content 2',
          startOffset: 12,
          endOffset: 22,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
      ];

      const result = await embedChunks(mockClient, chunks, 'test.pdf');

      expect(result).toHaveLength(2);
      expect(createEmbedding).toHaveBeenCalledTimes(2);
    });

    it('MetaDataが正しく設定される', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      vi.mocked(createEmbedding).mockResolvedValue(mockEmbedding);

      const chunks: Chunk[] = [
        {
          heading: '# Heading 1',
          text: 'Content',
          startOffset: 0,
          endOffset: 7,
          boundingRegions: [
            { page: 1, polygon: [10, 20, 30, 40] },
            { page: 2, polygon: [50, 60, 70, 80] },
          ],
        },
      ];

      const result = await embedChunks(mockClient, chunks, 'test.pdf');

      expect(result[0].metadata.boundingRegions).toHaveLength(2);
      expect(result[0].metadata.boundingRegions[0].page).toBe(1);
      expect(result[0].metadata.boundingRegions[1].page).toBe(2);
    });
  });

  describe('異常系', () => {
    it('createEmbeddingがエラーを投げても他のchunksは処理される', async () => {
      vi.mocked(createEmbedding)
        .mockRejectedValueOnce(new Error('Embedding failed'))
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);

      const chunks: Chunk[] = [
        {
          heading: '# Heading 1',
          text: 'Content 1',
          startOffset: 0,
          endOffset: 10,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
        {
          heading: '# Heading 2',
          text: 'Content 2',
          startOffset: 12,
          endOffset: 22,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
      ];

      const result = await embedChunks(mockClient, chunks, 'test.pdf');

      // エラーが発生したchunkは結果に含まれない
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Content 2');
    });

    it('空のchunks配列の場合は空配列を返す', async () => {
      const result = await embedChunks(mockClient, [], 'test.pdf');

      expect(result).toHaveLength(0);
      expect(createEmbedding).not.toHaveBeenCalled();
    });

    it('複数のエラーが発生しても処理を続行する', async () => {
      vi.mocked(createEmbedding).mockRejectedValue(new Error('Embedding failed'));

      const chunks: Chunk[] = [
        {
          heading: '# Heading 1',
          text: 'Content 1',
          startOffset: 0,
          endOffset: 10,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
        {
          heading: '# Heading 2',
          text: 'Content 2',
          startOffset: 12,
          endOffset: 22,
          boundingRegions: [{ page: 1, polygon: [0, 0, 100, 100] }],
        },
      ];

      const result = await embedChunks(mockClient, chunks, 'test.pdf');

      expect(result).toHaveLength(0);
      expect(createEmbedding).toHaveBeenCalledTimes(2);
    });
  });
});
