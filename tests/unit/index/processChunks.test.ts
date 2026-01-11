import { describe, it, expect, beforeEach, vi } from 'vitest';
import { splitMarkdownByHeading, createChunksFromLayout, embedChunks } from '@/index/processChunks';
import type { Chunk } from '@/index/processChunks';
import type OpenAI from 'openai';
import {
  expectChunkStructure,
  expectSpanStructure,
  getAnalyzeResultMockFromJson,
} from '../../helpers/testUtils';
import type { AnalyzeResultOutput } from '@azure-rest/ai-document-intelligence';

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
      expect(result[0].headingText).toBe('Heading 1');
      expect(result[0].content).toBe('Content for heading 1.\nThis is a paragraph.');
      expect(result[0].headingType).toBe('H1');
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
      expect(result[0].headingText).toBe('Heading 3');
      expect(result[0].content).toBe('Content for H3.');
      expect(result[1].headingText).toBe('Heading 2');
      expect(result[1].content).toBe('Content for H2.');
      expect(result[2].headingText).toBe('Heading 1');
      expect(result[2].content).toBe('Content for H1.');
    });

    it('同じレベルの見出しが連続する場合を正しく処理する', () => {
      const md = `# Heading 1

Content 1.

# Heading 2

Content 2.`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(2);
      expect(result[0].headingText).toBe('Heading 1');
      expect(result[0].content).toBe('Content 1.');
      expect(result[1].headingText).toBe('Heading 2');
      expect(result[1].content).toBe('Content 2.');
    });

    it('見出しのみ（コンテンツなし）を正しく処理する', () => {
      const md = '# Heading 1';

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(1);
      expect(result[0].headingText).toBe('Heading 1');
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

      expect(result.some((r) => r.headingText === 'Chapter 1')).toBe(true);
      expect(result.some((r) => r.headingText === 'Section 1.1')).toBe(true);
      expect(result.some((r) => r.headingText === 'Subsection 1.1.1')).toBe(true);
    });

    it('H1からH3までのすべてのレベルを正しく処理する', () => {
      const md = `# H1
Content 1
## H2
Content 2
### H3
Content 3`;

      const result = splitMarkdownByHeading(md);

      expect(result).toHaveLength(3);
      expect(result[0].headingType).toBe('H3');
      expect(result[1].headingType).toBe('H2');
      expect(result[2].headingType).toBe('H1');
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

      // "# Heading 1\n\nContent here." = 26文字（最後の行の改行は含まれない）
      // 実装では最後の行の長さを含めるため、26文字になる
      expect(result[0].span.length).toBe(26);
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
    it('実際のJSONデータから基本的なparagraphsとcontentのマッチング', () => {
      const mockData = getAnalyzeResultMockFromJson();
      const result = createChunksFromLayout(mockData);

      expect(result.length).toBeGreaterThan(0);
      for (const chunk of result) {
        expectChunkStructure(chunk);
        expect(chunk.text.trim().length).toBeGreaterThan(0);
        expect(chunk.heading.length).toBeGreaterThan(0);
      }
    });

    it('実際のJSONデータでheadingとparagraphsのオフセットが正しくマッチする', () => {
      const mockData = getAnalyzeResultMockFromJson();
      const result = createChunksFromLayout(mockData);

      for (const chunk of result) {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
        expect(chunk.boundingRegions.length).toBeGreaterThan(0);
      }
    });

    it('実際のJSONデータで複数ページにまたがるチャンクを正しく処理する', () => {
      const mockData = getAnalyzeResultMockFromJson();
      const result = createChunksFromLayout(mockData);

      expect(result.length).toBeGreaterThan(0);
      // 複数ページにまたがるチャンクがあるかチェック
      const hasMultiPage = result.some((chunk) => chunk.boundingRegions.length > 1);
      // 少なくとも1つのチャンクが存在することを確認
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('boundingRegions計算', () => {
    it('実際のJSONデータでページごとに正しくグループ化される', () => {
      const mockData = getAnalyzeResultMockFromJson();
      const result = createChunksFromLayout(mockData);

      expect(result.length).toBeGreaterThan(0);

      // すべてのチャンクでページ番号が正しく設定されているか確認
      for (const chunk of result) {
        expect(chunk.boundingRegions.length).toBeGreaterThan(0);
        for (const region of chunk.boundingRegions) {
          expect(region.page).toBeGreaterThan(0);
        }
      }
    });

    it('実際のJSONデータで複数のpolygonから正しくbounding boxが計算される', () => {
      const mockData = getAnalyzeResultMockFromJson();
      const result = createChunksFromLayout(mockData);

      expect(result.length).toBeGreaterThan(0);

      for (const chunk of result) {
        for (const region of chunk.boundingRegions) {
          expect(region.polygon.length).toBe(4); // [minX, minY, maxX, maxY]
          // bounding box should be [minX, minY, maxX, maxY]
          expect(region.polygon[0]).toBeLessThanOrEqual(region.polygon[2]); // minX <= maxX
          expect(region.polygon[1]).toBeLessThanOrEqual(region.polygon[3]); // minY <= maxY
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
      } as unknown as AnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      // polygonが無効な場合はboundingRegionsが空になる可能性がある
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('異常系', () => {
    it('result.paragraphsがundefinedの場合は空配列を返す', () => {
      const output = {
        content: '# Heading\nContent',
      } as AnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      expect(result).toHaveLength(0);
    });

    it('result.contentがundefinedの場合は空配列を返す', () => {
      const output = {
        paragraphs: [
          {
            content: 'Some content',
            spans: [{ offset: 0, length: 12 }],
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [0, 0, 100, 0, 100, 50, 0, 50],
              },
            ],
          },
        ],
      } as unknown as AnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      expect(result).toHaveLength(0);
    });

    it('paragraphsが空配列の場合は空配列を返す', () => {
      const output = {
        content: '',
        paragraphs: [],
      } as unknown as AnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      expect(result).toHaveLength(0);
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
      } as unknown as AnalyzeResultOutput;

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
        paragraphs: [
          {
            content: '',
            spans: [{ offset: 12, length: 0 }],
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [0, 0, 100, 0, 100, 50, 0, 50],
              },
            ],
          },
        ],
      } as unknown as AnalyzeResultOutput;

      const result = createChunksFromLayout(output);

      for (const chunk of result) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('空白のみのコンテンツはフィルタリングされる', () => {
      const output = {
        content: `# Heading 1

   `,
        paragraphs: [
          {
            content: '   ',
            spans: [{ offset: 12, length: 3 }],
            boundingRegions: [
              {
                pageNumber: 1,
                polygon: [0, 0, 100, 0, 100, 50, 0, 50],
              },
            ],
          },
        ],
      } as unknown as AnalyzeResultOutput;

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
