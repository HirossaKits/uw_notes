import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from 'playwright';
import { PATHS } from '@/config/paths';
import { saveExtraction } from '@/extract/saveExtraction';

if (!fs.existsSync(PATHS.UW_NOTES)) fs.mkdirSync(PATHS.UW_NOTES, { recursive: true });
if (!fs.existsSync(PATHS.QUESTIONS))
  fs.mkdirSync(PATHS.QUESTIONS, { recursive: true });

export interface UWorldOption {
  optionId: string;
  optionText: string;
  answerRate: number | null;
  isCorrectOption: boolean;
  isUserSelected: boolean;
}

export interface UWorldStats {
  correctPercentOverall: number | null; 
  timeSpentSeconds: number | null; 
}

export interface UWorldExtraction {
  url: string;
  questionId: string;
  stem: string | null;
  options: UWorldOption[];
  correctOptionId: string | null;
  userOptionId: string | null;
  explanation: string | null;
  images: {
    stem: string[];
    explanation: string[];
  };
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
 * Previous Test ページで Result をクリックして Test ページに移動して情報取得を繰り返す
 * p タグの属性 mattooltip が "Results" のものクリックして Test ページに移動する
 */
export async function extractUWorldReviewFromPreviousTests(page: Page): Promise<void> {
  const testLinks = await page.locator('p[mattooltip="Results"]').all();

  // ページネーションの最終まで繰り返す
  while (true) {
    // 各ResultsリンクをクリックしてTestページに移動
    for (const link of testLinks) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      
      // TestページからReviewページを取得
      const reviews = await extractUWorldReviewFromTest(page);
      
      // Previous Tests ページに戻る
      await page.goto(process.env.PREVIOUS_TESTS_URL);
      await page.waitForLoadState('networkidle');
      await new Promise((r) => setTimeout(r, 1000));
    }
    try {
      const nextButton = page.locator('button[aria-label="Next page:"]').first();
      await nextButton.waitFor({ state: 'visible' ,timeout: 5000 });
      await nextButton.click();
      await page.waitForLoadState('domcontentloaded');
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      break;
    }
  }
}

/**
 * Test のページで Review Test をクリックし Review ページに移動して情報取得を繰り返す
 * i タグの属性 mattooltip が "Review Test" のものクリックして Review ページに移動する
 */
export async function extractUWorldReviewFromTest(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  const locator = page.locator('i[mattooltip="Review Test"]');
  await locator.first().waitFor({ state: 'visible' });
  const reviewTestLink = locator.first();
  
  const results: UWorldExtraction[] = [];

  await reviewTestLink.click();
  await page.waitForLoadState('domcontentloaded');

  for (let i = 0; i < 10; i++) {
    const review = await extractUWorldReview(page);

    if (i === 9) {
      await page.getByText('End Review?').waitFor({ state: 'visible' });
      await page.getByText('Yes').click();
      await page.waitForLoadState('domcontentloaded');
      await new Promise((r) => setTimeout(r, 1000));
      break;
    }

    await page.getByText('Next').first().click();
    await page.waitForLoadState('domcontentloaded');
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Review ページから情報を抽出する
 */
export async function extractUWorldReview(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.question-id').first().waitFor({ state: 'visible' });

  const url = page.url();
  console.log("🔍 Extracting review:", url); 

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
  const questionDir = PATHS.questionDir(questionId);
  const imagesDir = PATHS.questionImages(questionId);

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
    images: {
      stem: [],
      explanation: []
    },
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
      result.images.stem.push(path.join('images', filename));
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

    // 回答率 "(%)"
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
      result.images.explanation.push(path.join('images', filename));
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

  saveExtraction(result);
  console.log("✅ Saved extraction:", url); 
}
