export const createMockParagraph = (
  content: string,
  offset: number,
  pageNumber: number,
  polygon: number[] = [0, 0, 100, 0, 100, 50, 0, 50],
) => ({
  content,
  spans: [{ offset, length: content.length }],
  boundingRegions: [
    {
      pageNumber,
      polygon,
    },
  ],
});
