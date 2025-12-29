import * as path from 'node:path';

const PROJECT_ROOT = process.cwd();

export const PATHS = {
  // Root directories
  ROOT: PROJECT_ROOT,
  UW_NOTES: path.join(PROJECT_ROOT, 'uw_notes'),
  PUBLIC: path.join(PROJECT_ROOT, 'public'),
  DB: path.join(PROJECT_ROOT, 'db'),

  // Public subdirectories
  PDF: {
    ROOT: path.join(PROJECT_ROOT, 'public', 'pdf'),
    CHUNK: path.join(PROJECT_ROOT, 'public', 'pdf', 'chunk'),
    MASTER: path.join(PROJECT_ROOT, 'public', 'master'),
  },
  JSON: path.join(PROJECT_ROOT, 'public', 'json'),

  // UWorld notes subdirectories
  QUESTIONS: path.join(PROJECT_ROOT, 'uw_notes', 'questions'),

  // Database
  DATABASE: path.join(PROJECT_ROOT, 'db', 'vector_store.sqlite3'),

  // Helper functions
  questionDir: (questionId: string) =>
    path.join(PROJECT_ROOT, 'uw_notes', 'questions', questionId),
  questionJson: (questionId: string) =>
    path.join(PROJECT_ROOT, 'uw_notes', 'questions', questionId, 'question.json'),
  questionMarkdown: (questionId: string) =>
    path.join(PROJECT_ROOT, 'uw_notes', 'questions', questionId, `${questionId}.md`),
  questionImages: (questionId: string) =>
    path.join(PROJECT_ROOT, 'uw_notes', 'questions', questionId, 'images'),
  pdfChunk: (stem: string, startPage: number, endPage: number) =>
    path.join(PROJECT_ROOT, 'public', 'pdf', 'chunk', `${stem}_${startPage}_${endPage}.pdf`),
} as const;

