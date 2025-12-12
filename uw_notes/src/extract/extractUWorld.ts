import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from 'playwright';

const ROOT_DIR = path.resolve(process.cwd(), 'uw_notes');
const QUESTIONS_DIR = path.join(ROOT_DIR, 'questions');

if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
if (!fs.existsSync(QUESTIONS_DIR))
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true });

/** 改善後の JSON スキーマ */
export interface UWorldOption {
  optionId: string;        // A, B, C...
  optionText: string;
  answerRate: number | null; // (72%) → 72
  isCorrectOption: boolean;
  isUserSelected: boolean;
}

export interface UWorldStats {
  correctPercentOverall: number | null; // "72%" → 72
  timeSpentSeconds: number | null;      // "06 mins, 10 secs" → 370
}

export interface UWorldExtraction {
  url: string;
  questionId: string;
  stem: string | null;
  options: UWorldOption[];
  correctOptionId: string | null;  // "F"
  userOptionId: string | null;     // "E"
  explanation: string | null;
  images: string[];
  subject: string | null;
  system: string | null;
  topic: string | null;
  stats: UWorldStats;
}

function parseAnswerRate(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)%/);
  return m ? Number(m[1]) : null;
}

function parseTimeSpent(raw: string | null): number | null {
  if (!raw) return null;

  // “06 mins, 10 secs”
  const min = raw.match(/(\d+)\s*min/);
  const sec = raw.match(/(\d+)\s*sec/);

  const mins = min ? Number(min[1]) : 0;
  const secs = sec ? Number(sec[1]) : 0;

  return mins * 60 + secs;
}

/**
 * Review問題を抽出して JSONスキーマを LLM用に改善。
 */
export async function extractUWorldReview(page: Page): Promise<UWorldExtraction> {
  await page.waitForLoadState('domcontentloaded');

  const url = page.url();

  // ---- Question ID ----
  const questionId = await page.evaluate(() => {
    const q = document.querySelector('.question-id');
    if (!q || !q.parentElement) return null;

    const text = q.parentElement.textContent || '';
    const m = text.match(/Question\s*Id:\s*(\d+)/i);
    return m ? m[1] : null;
  });

  if (!questionId) {
    throw new Error('Failed to extract questionId.');
  }

  // setup folder
  const questionDir = path.join(QUESTIONS_DIR, questionId);
  const imagesDir = path.join(questionDir, 'images');

  if (!fs.existsSync(questionDir)) fs.mkdirSync(questionDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  const result: UWorldExtraction = {
    url,
    questionId,
    stem: null,
    options: [],
    correctOptionId: null,
    userOptionId: null,
    explanation: null,
    images: [],
    subject: null,
    system: null,
    topic: null,
    stats: {
      correctPercentOverall: null,
      timeSpentSeconds: null
    }
  };

  // ---- Stem ----
  const stemEl = page.locator('#questionText');
  if (await stemEl.count()) {
    result.stem = (await stemEl.innerText()).trim();
  }

  // Stem内画像
  const stemImgs = stemEl.locator('img');
  for (let i = 0; i < await stemImgs.count(); i++) {
    const el = stemImgs.nth(i);
    const filename = `stem_${i}.png`;
    const filepath = path.join(imagesDir, filename);
    try {
      await el.screenshot({ path: filepath });
      result.images.push(path.join('images', filename));
    } catch {}
  }

  // ---- Options ----
  const rows = page.locator('tr.answer-choice-background');
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);

    // 選択肢 ID(A,B..)
    const letterRaw = await row
      .locator('td.left-td span')
      .last()
      .innerText()
      .catch(() => '');
    const optionId = letterRaw.replace('.', '').trim();

    // テキスト
    const optionText = (await row
      .locator('.answer-choice-content span')
      .first()
      .innerText()
      .catch(() => '')
    ).trim();

    // 回答率 "(72%)"
    const percentRaw = await row
      .locator('.answer-choice-content span.ng-star-inserted')
      .first()
      .innerText()
      .catch(() => null);

    const answerRate = parseAnswerRate(percentRaw);

    // 正解マーク
    const isCorrectOption = (await row.locator('i.fa-check').count()) > 0;

    // 自分の選択
    const isUserSelected = (await row.locator('.mat-radio-checked').count()) > 0;

    result.options.push({
      optionId,
      optionText,
      answerRate,
      isCorrectOption,
      isUserSelected
    });

    if (isCorrectOption) result.correctOptionId = optionId;
    if (isUserSelected) result.userOptionId = optionId;
  }

  // ---- Stats ----
  // Correct overall
  try {
    const correctBlock = page.locator('.fa-chart-bar').locator('xpath=..');
    if (await correctBlock.count()) {
      const v = await correctBlock.locator('.stats-value').first().innerText();
      result.stats.correctPercentOverall = parseAnswerRate(v);
    }
  } catch {}

  // Time spent
  try {
    const timeBlock = page.locator('.fa-clock').locator('xpath=..');
    if (await timeBlock.count()) {
      const v = await timeBlock.locator('.stats-value').first().innerText();
      result.stats.timeSpentSeconds = parseTimeSpent(v);
    }
  } catch {}

  // ---- Explanation ----
  const expl = page.locator('#first-explanation');
  if (await expl.count()) {
    result.explanation = (await expl.innerText()).trim();
  }

  // Explanation内画像
  const explImgs = expl.locator('img');
  for (let i = 0; i < await explImgs.count(); i++) {
    const el = explImgs.nth(i);
    const filename = `explanation_${i}.png`;
    const filepath = path.join(imagesDir, filename);
    try {
      await el.screenshot({ path: filepath });
      result.images.push(path.join('images', filename));
    } catch {}
  }

  // ---- Subject / System / Topic ----
  const standards = page.locator('.standards .standard');
  if (await standards.count() >= 3) {
    const getStd = async (idx: number) =>
      (
        await standards
          .nth(idx)
          .locator('.standard-description')
          .innerText()
          .catch(() => null)
      )?.trim() ?? null;

    result.subject = await getStd(0);
    result.system = await getStd(1);
    result.topic = await getStd(2);
  }

  return result;
}
