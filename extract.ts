import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type BrowserContext,
  type ElementHandle,
  type Page,
  chromium,
} from 'playwright';

const USER_DATA_DIR = path.resolve(process.cwd(), 'pw-user-data'); // ログイン保持用。既存プロファイル使うならそのパスに変える

// 出力先
const OUT_DIR = path.resolve(process.cwd(), 'uw_notes');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const IMG_DIR = path.join(OUT_DIR, 'images');
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

interface ExtractionResult {
  url: string;
  stem: string | null;
  options: Array<{ id: string; text: string }>;
  your_answer: string | null;
  correct_answer: string | null;
  explanation: string | null;
  images: string[];
}

async function saveBinary(
  url: string,
  outPath: string,
  context: BrowserContext
): Promise<boolean> {
  try {
    const page = await context.newPage();
    const resp = await page.goto(url, { timeout: 15000 });
    if (!resp || !resp.ok()) {
      await page.close();
      return false;
    }
    const buffer = await resp.body();
    fs.writeFileSync(outPath, buffer);
    await page.close();
    return true;
  } catch (e) {
    const error = e as Error;
    console.warn('saveBinary failed', error.message);
    return false;
  }
}

async function elementScreenshot(
  elHandle: ElementHandle,
  filePath: string
): Promise<void> {
  try {
    const box = await elHandle.boundingBox();
    if (!box) {
      // 要素の位置が取れない場合はフルページキャプチャ
      await elHandle.screenshot({ path: filePath });
      return;
    }
    await elHandle.screenshot({ path: filePath });
  } catch (e) {
    const error = e as Error;
    console.warn('elementScreenshot failed:', error.message);
  }
}

async function extractFromPage(page: Page): Promise<ExtractionResult> {
  // 複数の戦略で要素を取る。サイト側でclass名が変わることを想定してフォールバック多数用意。
  const result: ExtractionResult = {
    url: page.url(),
    stem: null,
    options: [],
    your_answer: null,
    correct_answer: null,
    explanation: null,
    images: [],
  };

  // 1) try semantic / obvious selectors
  const selectors = [
    'article', // generic
    '.question',
    '.question-stem',
    '.stem',
    '#question',
    '[data-test="question"]',
    'main',
  ];

  for (const s of selectors) {
    const el = await page.$(s);
    if (el) {
      const text = (await el.innerText()).trim();
      if (text && text.length > 50) {
        // ある程度長ければ stem とみなす
        result.stem = text;
        break;
      }
    }
  }

  // 2) fallback: try to find large heading block
  if (!result.stem) {
    const el = await page.$('h1, h2, h3, .question-text, .prompt');
    if (el) result.stem = (await el.innerText()).trim();
  }

  // 3) final fallback: body text (制限して切り出す)
  if (!result.stem) {
    const bodyText =
      (await page.evaluate(() => document.body.innerText || '')) || '';
    result.stem = bodyText.split('\n').slice(0, 30).join('\n').trim();
  }

  // 選択肢の抽出：いくつかの候補 selector を試す
  const optionSelectors = [
    '.choice',
    '.answer-choice',
    '.option',
    '.answers li',
    '.choices li',
    '[role="radio"]',
    '[data-test="answer"]',
    'label',
  ];
  let optionTexts: string[] = [];
  for (const sel of optionSelectors) {
    const nodes = await page.$$(sel);
    if (nodes.length >= 2) {
      const texts: string[] = [];
      for (const n of nodes) {
        const t = (await n.innerText()).trim();
        if (t) texts.push(t);
      }
      if (texts.length >= 2) {
        optionTexts = texts;
        break;
      }
    }
  }
  // as final fallback, try to parse lines that look like "A. ..." or "1) ..." in the stem area
  if (optionTexts.length === 0 && result.stem) {
    const maybe = result.stem
      .split('\n')
      .filter((l) => /^\s*[A-D]\s*[.\)]\s*/.test(l) || /^\s*\d+\)\s*/.test(l));
    if (maybe.length >= 2) optionTexts = maybe;
  }

  // Normalize options
  result.options = optionTexts.map((t, i) => ({
    id: String.fromCharCode(65 + i),
    text: t,
  }));

  // あなたの答え（選択中の radio / checked を探す）
  try {
    const selected = await page.evaluate(() => {
      // radio/checkbox の checked を探す
      const els = Array.from(
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]')
      ) as HTMLInputElement[];
      const checked = els.find((e) => e.checked);
      if (checked) {
        // try to find associated label text
        const id = checked.id;
        if (id) {
          const lbl = document.querySelector(`label[for="${id}"]`);
          if (lbl) return lbl.textContent?.trim() || null;
        }
        // fallback: parent label
        const p = checked.closest('label');
        if (p) return p.textContent?.trim() || null;
        return null;
      }
      // aria-checked
      const aria = Array.from(
        document.querySelectorAll(
          '[role="radio"], [role="option"], [role="checkbox"]'
        )
      ).find(
        (e) =>
          e.getAttribute('aria-checked') === 'true' ||
          e.getAttribute('aria-checked') === 'mixed'
      );
      if (aria) return aria.textContent?.trim() || null;
      return null;
    });
    if (selected) result.your_answer = selected;
  } catch (e) {
    const error = e as Error;
    console.warn('your_answer detect failed', error.message);
  }

  // 正答・解説の検出（"Correct", "Answer", "Explanation" を探す）
  const explSelectors = [
    '.explanation',
    '#explanation',
    '.explain',
    '.answer-explanation',
    '[data-test="explanation"]',
  ];
  let explText: string | null = null;
  for (const s of explSelectors) {
    const el = await page.$(s);
    if (el) {
      explText = (await el.innerText()).trim();
      if (explText && explText.length > 10) {
        result.explanation = explText;
        break;
      }
    }
  }
  // fallback: search by keywords inside body
  if (!result.explanation) {
    const body = await page.evaluate(() => document.body.innerText || '');
    const idx = body.search(/Explanation:|Correct Answer:|Answer:/i);
    if (idx >= 0) {
      result.explanation = body.slice(idx, idx + 4000).trim();
    }
  }

  // correct answer: try to parse from explanation or markers like "Correct: A"
  if (!result.correct_answer && result.explanation) {
    const m = result.explanation.match(
      /(Correct Answer|Correct):\s*([A-D]|[A-D]\.)/i
    );
    if (m) result.correct_answer = m[2].replace('.', '').trim();
    else {
      // try any "Answer: X"
      const m2 = result.explanation.match(/Answer[:\s]*([A-D]|[A-D]\.)/i);
      if (m2) result.correct_answer = m2[1].replace('.', '').trim();
    }
  }

  // 画像の取得：explanation 範囲内の <img>、もしくは canvas をスクショ
  // まず説明ブロックがあればその中の画像を保存
  try {
    let explEl: ElementHandle | null = null;
    for (const s of explSelectors) {
      const el = await page.$(s);
      if (el) {
        explEl = el;
        break;
      }
    }
    const containers = explEl
      ? [explEl]
      : [await page.$('main'), await page.$('article'), await page.$('body')];
    for (const c of containers) {
      if (!c) continue;
      // 1) imgs
      const imgs = await c.$$('img');
      for (const img of imgs) {
        const src = await img.getAttribute('src');
        if (src) {
          // absolute url
          const url = src.startsWith('http')
            ? src
            : new URL(src, page.url()).toString();
          const name = `img_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}${path.extname(url).split('?')[0] || '.png'}`;
          const outPath = path.join(IMG_DIR, name);
          const saved = await saveBinary(url, outPath, page.context());
          if (saved) result.images.push(path.relative(OUT_DIR, outPath));
        } else {
          // inline data URL
          const data = await img.evaluate((n) => (n as HTMLImageElement).src);
          if (data?.startsWith('data:')) {
            const match = data.match(/^data:(.+);base64,(.*)$/);
            if (match) {
              const ext = match[1].split('/').pop() || 'png';
              const buf = Buffer.from(match[2], 'base64');
              const name = `img_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}.${ext}`;
              const outPath = path.join(IMG_DIR, name);
              fs.writeFileSync(outPath, buf);
              result.images.push(path.relative(OUT_DIR, outPath));
            }
          }
        }
      }

      // 2) canvas 要素 があればスクショ（UWorld の画像が canvas のことがある）
      const canvases = await c.$$('canvas');
      for (const can of canvases) {
        const name = `canvas_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.png`;
        const outPath = path.join(IMG_DIR, name);
        await elementScreenshot(can, outPath);
        result.images.push(path.relative(OUT_DIR, outPath));
      }

      // 3) 画像が1つ以上見つかったら break
      if (result.images.length > 0) break;
    }

    // 最終手段: ページ全体のスクリーンショット（説明が取れない時の保険）
    if (result.images.length === 0) {
      const name = `fullpage_${Date.now()}.png`;
      const outPath = path.join(IMG_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      result.images.push(path.relative(OUT_DIR, outPath));
    }
  } catch (e) {
    const error = e as Error;
    console.warn('image extraction failed', error.message);
  }

  return result;
}

(async () => {
  // persistent context を使ってログイン状態を保つ（既存プロファイルを使うとログイン済みChromeを流用できる）
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1200, height: 900 },
    args: ['--start-maximized'],
  });

  // MCP を入れるならここで agent を初期化して context/page と接続する（Playwright MCP API による）。
  // 例: (疑似コード)
  // const agent = await createMCPAgent({ context });
  // await agent.registerTasks(...)

  // 既存のページから UWorld のページを探す（開いているタブにいる想定）
  const pages = context.pages();
  let target = pages.find(
    (p) => p.url().includes('uworld') || p.url().includes('uworld.com')
  );
  if (!target) {
    // なければユーザーに開いてもらうよう促す（自動で開くこともできる）
    console.log(
      'UWorld のタブが見つかりません。UWorld の問題ページをブラウザで開いてから Enter を押してください。'
    );
    process.stdin.resume();
    await new Promise<void>((resolve) =>
      process.stdin.once('data', () => resolve())
    );
    // 再取得
    const newPages = context.pages();
    target = newPages.find(
      (p) => p.url().includes('uworld') || p.url().includes('uworld.com')
    );
    if (!target) {
      console.error(
        'UWorld タブがまだ見つかりません。スクリプトを終了します。'
      );
      await context.close();
      process.exit(1);
    }
  }

  // フォーカスをそのページへ
  const page = target;
  await page.bringToFront();

  // ページが動的に読み込まれるのを待つ（適宜調整）
  await page.waitForLoadState('networkidle');

  // 抽出
  const extracted = await extractFromPage(page);

  // JSON を保存
  const id = `uw_${Date.now()}`;
  const jsonPath = path.join(OUT_DIR, `${id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(extracted, null, 2), 'utf8');
  console.log('Saved JSON to', jsonPath);

  // 簡易 Markdown も作る（テンプレの一部）
  const mdParts: string[] = [];
  mdParts.push(`# UWorld – ${id}`);
  mdParts.push(`\n> source: ${extracted.url}\n`);
  mdParts.push('## 🧠 Key Takeaways (auto-extracted stem snippet)');
  mdParts.push(`\n${extracted.stem?.slice(0, 200) || ''}\n`);
  mdParts.push('## ❌ Why I Got It Wrong');
  mdParts.push(`- Your answer: ${extracted.your_answer || 'N/A'}`);
  mdParts.push(`- Correct answer: ${extracted.correct_answer || 'N/A'}`);
  mdParts.push('## 🧩 Explanation\n');
  mdParts.push(extracted.explanation || 'N/A');

  if (extracted.images?.length) {
    mdParts.push('\n## 🖼 Images\n');
    for (const img of extracted.images)
      mdParts.push(`![img](${path.join('images', img)})`);
  }

  const mdPath = path.join(OUT_DIR, `${id}.md`);
  fs.writeFileSync(mdPath, mdParts.join('\n\n'), 'utf8');
  console.log('Saved Markdown to', mdPath);

  console.log(
    'Extraction complete. You can now feed the JSON/Markdown to your LLM pipeline for formatting.'
  );

  // context は開いたままにしておく（必要なら閉じる）
  // await context.close();
})();
