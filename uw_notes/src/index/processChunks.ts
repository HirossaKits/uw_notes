import { createEmbedding } from "@/llm/embedding";
import { AnalyzeResultOutput } from "@azure-rest/ai-document-intelligence";
import OpenAI from "openai";

type Chunk = {
  heading: string;
  text: string;
  startOffset: number;
  endOffset: number;
  boundingRegions: {page: number; polygon: number[]}[];
};

export type MetaData = {
  heading: string;
  boundingRegions: {page: number; polygon: number[]}[];
  textStartOffset: number;
  textEndOffset: number;
  source: string;
};

export type EmbeddedChunk = {
  text: string;
  embedding: number[];
  metadata: MetaData;
};

export function createChunksFromLayout(result: AnalyzeResultOutput): Chunk[] {
  if (!result.paragraphs) return [];
  if (!result.content) {
    console.warn('result.content is missing, returning empty chunks');
    return [];
  }
  
  const paragraphs = result.paragraphs;
  const headings = splitMarkdownByHeading(result.content);

  const chunks = headings.map((h) => {
    // Filter paragraphs that fall within the heading's span range
    const paragraphsInRange = paragraphs.filter((p) => {
      const spanOffset = p.spans?.[0]?.offset;
      if (spanOffset === undefined) return false;
      return spanOffset >= h.span.offset && spanOffset < h.span.offset + h.span.length;
    });
    
    // Group paragraphs by page and calculate bounding box for each page
    // polygon format from Azure Document Intelligence: [x1, y1, x2, y2, x3, y3, x4, y4]
    const polygonsByPage = new Map<number, number[][]>();
    
    for (const p of paragraphsInRange) {
      const pageNum = p.boundingRegions?.[0]?.pageNumber;
      const polygon = p.boundingRegions?.[0]?.polygon;
      
      if (pageNum !== undefined && polygon && polygon.length >= 8) {
        if (!polygonsByPage.has(pageNum)) {
          polygonsByPage.set(pageNum, []);
        }
        polygonsByPage.get(pageNum)!.push(polygon);
      }
    }
    
    // Calculate bounding box for each page
    const boundingRegions = Array.from(polygonsByPage.entries()).map(([page, polygons]) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
      for (const polygon of polygons) {
        // Process all coordinates in the polygon (x, y pairs)
        for (let i = 0; i < polygon.length; i += 2) {
          const x = polygon[i];
          const y = polygon[i + 1];
          if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      
      // Return bounding box as [minX, minY, maxX, maxY]
      const boundingBox = (minX !== Infinity && minY !== Infinity && maxX !== -Infinity && maxY !== -Infinity)
        ? [minX, minY, maxX, maxY]
        : [0, 0, 0, 0]; // Fallback if no valid coordinates
      
      return {
        page,
        polygon: boundingBox,
      };
    });

    return {
      heading: h.headingText,
      text: h.content,
      startOffset: h.span.offset,
      endOffset: h.span.offset + h.span.length,
      boundingRegions: boundingRegions,
    };
  });
  
  return chunks.filter((c) => c.text.trim().length > 0);
}

const heading = {
  H1: "#",
  H2: "##",
  H3: "###",
  // ignore H4 and H5 for now
  // H4: "####",
  // H5: "#####"
} as const;

type HeadingType = keyof typeof heading;

export function splitMarkdownByHeading(md_content: string): {headingType: HeadingType, headingText: string, content:string, span:{offset: number, length: number}}[] {
  const lines = md_content.split('\n');
  const result: {headingType: HeadingType, headingText: string, content:string, span:{offset: number, length: number}}[] = [];
  
  const headingRegex = /^(#{1,5})\s+(.+)$/;
  
  // Calculate the offset of a line in the original md_content
  const getLineOffset = (lineIndex: number): number => {
    let offset = 0;
    for (let i = 0; i < lineIndex; i++) {
      offset += lines[i].length;
      if (i < lines.length - 1) {
        offset += 1; // Add newline character
      }
    }
    return offset;
  };
  
  // Calculate content end offset based on the last content line index
  const getContentEndOffset = (contentEndLineIndex: number, headingStartOffset: number, headingLineIndex: number): number => {
    if (contentEndLineIndex >= 0 && contentEndLineIndex < lines.length - 1) {
      return getLineOffset(contentEndLineIndex + 1); // Start of next line (exclusive)
    }
    if (contentEndLineIndex >= 0) {
      return getLineOffset(contentEndLineIndex) + lines[contentEndLineIndex].length; // End of last line (inclusive)
    }
    return headingStartOffset + lines[headingLineIndex].length; // Only heading line
  };
  
  // Remove page metadata comments (PageBreak, PageNumber, PageHeader) from the end of content
  const removePageMetadataComments = (content: string): string => {
    // Match HTML comments at the end: <!-- PageBreak -->, <!-- PageNumber="..." -->, <!-- PageHeader="..." -->
    // Also matches empty lines before these comments
    return content.replace(/(\n?\r?\n?<!--\s*(?:PageBreak|PageNumber|PageHeader).*?-->\s*)+$/, '').trim();
  };
  
  // Process a completed heading from the stack and add it to the result
  const processCompletedHeading = (
    completedHeading: {level: number, text: string, lineIndex: number, contentLines: string[], contentEndLineIndex?: number},
    defaultContentEndLineIndex: number
  ): void => {
    if (completedHeading.level < 1 || completedHeading.level > 3) {
      console.warn(`Only heading level 1-3 are supported. Skipping heading: ${completedHeading.text}`);
      return;
    }
    
    const headingType = `H${completedHeading.level}` as HeadingType;
    const headingStartOffset = getLineOffset(completedHeading.lineIndex);
    const contentEndLineIndex = completedHeading.contentEndLineIndex ?? defaultContentEndLineIndex;
    const contentEndOffset = getContentEndOffset(contentEndLineIndex, headingStartOffset, completedHeading.lineIndex);
    
    const originalContent = completedHeading.contentLines.join('\n').trim();
    const fullContent = removePageMetadataComments(originalContent);
    // Adjust length to match the cleaned content length (after removing HTML comments)
    // The original length is (contentEndOffset - headingStartOffset), but we need to subtract
    // the difference between originalContent and fullContent
    const originalLength = contentEndOffset - headingStartOffset;
    const removedLength = originalContent.length - fullContent.length;
    const length = originalLength - removedLength;
    
    result.push({
      headingType,
      headingText: completedHeading.text,
      content: fullContent,
      span: {
        offset: headingStartOffset,
        length,
      },
    });
  };
  
  const headingStack: Array<{level: number, text: string, lineIndex: number, contentLines: string[], contentEndLineIndex?: number}> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(headingRegex);
    
    if (match) {
      const level = match[1].length;
      const headingText = match[2].trim();

  
      if (headingStack.length > 0 && level > 3) {
        headingStack[headingStack.length - 1].contentLines.push(line);
        headingStack[headingStack.length - 1].contentEndLineIndex = i;
      }
      
      // When a heading of the same or higher level appears,
      // process all lower-level headings from the stack and add them to the result
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        const completedHeading = headingStack.pop()!;
        processCompletedHeading(completedHeading, i - 1);
      }
      
      // Add the new heading to the stack
      headingStack.push({
        level,
        text: headingText,
        lineIndex: i,
        contentLines: [],
      });
    } else {
      // Non-heading lines are added as content to the topmost heading in the stack
      if (headingStack.length > 0) {
        headingStack[headingStack.length - 1].contentLines.push(line);
        headingStack[headingStack.length - 1].contentEndLineIndex = i;
      }
    }
  }
  
  // Process all remaining headings
  while (headingStack.length > 0) {
    const completedHeading = headingStack.pop()!;
    processCompletedHeading(completedHeading, lines.length - 1);
  }
  
  return result;
}

export async function embedChunks(client: OpenAI, chunks: Chunk[], source: string): Promise<EmbeddedChunk[]> {
  const embedded: EmbeddedChunk[] = [];

  for (const c of chunks) {
    try {
      const embedding = await createEmbedding(c.text);
      
      embedded.push({
        text: c.text,
        embedding: embedding,
        metadata: {
          boundingRegions: c.boundingRegions,
          textStartOffset: c.startOffset,
          textEndOffset: c.endOffset,
          source: source,
          heading: c.heading,
        },
      });
    } catch (error) {
      const pageInfo = c.boundingRegions.length > 0 
        ? `pages [${c.boundingRegions.map(br => br.page).join(', ')}]` 
        : 'unknown page';
      console.error(`Failed to embed chunk at ${pageInfo}:`, error);
    }
  }

  return embedded;
}