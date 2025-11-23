import * as fs from 'node:fs';
import * as path from 'node:path';
import { Page } from 'playwright';

const OUT_DIR = path.resolve(process.cwd(), 'uw_notes');
const IMG_DIR = path.join(OUT_DIR, 'images');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR);

export interface UWorldExtraction {
  url: string;
  questionId: string | null;
  stem: string | null;

  options: Array<{
    id: string; // A, B, C...
    text: string;
    percent: string | null;
    isCorrect: boolean;
    isYourAnswer: boolean;
  }>;

  correctAnswer: string | null;
  yourAnswer: string | null;

  explanation: string | null;
  images: string[];

  subject: string | null;
  system: string | null;
  topic: string | null;

  stats: {
    correctPercent: string | null;
    timeSpent: string | null;
  };
}

export async function extractUWorldReview(page: Page): Promise<UWorldExtraction> {
  await page.waitForLoadState('domcontentloaded');

  const result: UWorldExtraction = {
    url: page.url(),
    questionId: null,
    stem: null,
    options: [],
    correctAnswer: null,
    yourAnswer: null,
    explanation: null,
    images: [],
    subject: null,
    system: null,
    topic: null,
    stats: {
      correctPercent: null,
      timeSpent: null,
    },
  };

  // ---- Question ID ----
  result.questionId = await page.locator('.question-id').first().innerText().catch(() => null);

  // ---- Stem ----
  const stemEl = page.locator('#questionText');
  if ((await stemEl.count()) > 0) {
    result.stem = (await stemEl.innerText()).trim();
  }

  // ---- Options ----
  const rows = page.locator('tr.answer-choice-background');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);

    const letter = await row.locator('td:first-of-type span span').innerText().catch(() => '');
    const cleanLetter = letter.replace('.', '').trim();

    const text = await row.locator('.answer-choice-content span').first().innerText().catch(() => '');

    // percent: "(72%)"
    const percent = await row.locator('.answer-choice-content span.ng-star-inserted').innerText().catch(() => null);

    const isCorrect = (await row.locator('i.fa-check').count()) > 0;

    const isYourAnswer = (await row.locator('.mat-radio-checked').count()) > 0;

    result.options.push({
      id: cleanLetter,
      text: text.trim(),
      percent,
      isCorrect,
      isYourAnswer,
    });

    if (isYourAnswer) result.yourAnswer = cleanLetter;
    if (isCorrect) result.correctAnswer = cleanLetter;
  }

  // ---- Stats (correct %, time spent) ----
  result.stats.correctPercent = await page
    .locator('.fa-chart-bar')
    .locator('xpath=following-sibling::*')
    .locator('.stats-value')
    .innerText()
    .catch(() => null);

  result.stats.timeSpent = await page
    .locator('.fa-clock')
    .locator('xpath=following-sibling::*')
    .locator('.stats-value')
    .innerText()
    .catch(() => null);

  // ---- Explanation ----
  const expl = page.locator('#first-explanation');
  if ((await expl.count()) > 0) {
    result.explanation = (await expl.innerText()).trim();
  }

  // ---- Explanation Images ----
  const imgs = expl.locator('img');
  const imgCount = await imgs.count();

  for (let i = 0; i < imgCount; i++) {
    const el = imgs.nth(i);
    const filename = `uw_img_${Date.now()}_${i}.png`;
    const filepath = path.join(IMG_DIR, filename);

    try {
      await el.screenshot({ path: filepath });
      result.images.push(`images/${filename}`);
    } catch {}
  }

  // ---- Subject / System / Topic ----
  const std = page.locator('.standards .standard');

  const stdCount = await std.count();
  if (stdCount >= 3) {
    result.subject = await std.nth(0).locator('.standard-description').innerText().catch(() => null);
    result.system = await std.nth(1).locator('.standard-description').innerText().catch(() => null);
    result.topic = await std.nth(2).locator('.standard-description').innerText().catch(() => null);
  }

  return result;
}
