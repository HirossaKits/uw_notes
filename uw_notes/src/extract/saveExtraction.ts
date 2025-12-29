import * as fs from 'node:fs';
import type { UWorldExtraction } from './extractUWorld';
import { PATHS } from '@/config/paths';

if (!fs.existsSync(PATHS.UW_NOTES)) fs.mkdirSync(PATHS.UW_NOTES, { recursive: true });
if (!fs.existsSync(PATHS.QUESTIONS))
  fs.mkdirSync(PATHS.QUESTIONS, { recursive: true });

export function saveExtraction(data: UWorldExtraction): void {
  const questionDir = PATHS.questionDir(data.questionId);
  if (!fs.existsSync(questionDir))
    fs.mkdirSync(questionDir, { recursive: true });

  const jsonPath = PATHS.questionJson(data.questionId);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  console.log('Saved JSON to', jsonPath);
}