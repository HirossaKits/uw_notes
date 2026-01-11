import { describe, it, expect } from 'vitest';
import { getBoundingBox } from '@/pdf/processPdf';
import type { BoundingBox } from '@/pdf/processPdf';

describe('getBoundingBox', () => {
  describe('正常系', () => {
    it('単一のポリゴンから正しくバウンディングボックスを計算する', () => {
      // ポリゴン形式: [x1, y1, x2, y2, x3, y3, x4, y4]
      const polygons = [[10, 20, 30, 20, 30, 40, 10, 40]];

      const result = getBoundingBox(polygons);

      expect(result).toEqual({
        left: 10,
        top: 20,
        right: 30,
        bottom: 40,
      });
    });

    it('複数のポリゴンから正しくバウンディングボックスを計算する', () => {
      const polygons = [
        [10, 20, 30, 20, 30, 40, 10, 40],
        [50, 60, 70, 60, 70, 80, 50, 80],
      ];

      const result = getBoundingBox(polygons);

      expect(result).toEqual({
        left: 10,
        top: 20,
        right: 70,
        bottom: 80,
      });
    });
  });
});
