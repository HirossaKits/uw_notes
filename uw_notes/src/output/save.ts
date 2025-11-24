import * as fs from 'node:fs';
import * as path from 'node:path';
import type { UWorldExtraction } from '../extractor/extractUWorldReview';

const ROOT_DIR = path.resolve(process.cwd(), 'uw_notes');
const QUESTIONS_DIR = path.join(ROOT_DIR, 'questions');

if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
if (!fs.existsSync(QUESTIONS_DIR))
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true });

export function saveExtraction(data: UWorldExtraction): void {
  const questionDir = path.join(QUESTIONS_DIR, data.questionId);
  if (!fs.existsSync(questionDir))
    fs.mkdirSync(questionDir, { recursive: true });

  const jsonPath = path.join(questionDir, 'question.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  console.log('Saved JSON to', jsonPath);
}