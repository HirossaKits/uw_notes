import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import OpenAI from 'openai';
import type { UWorldExtraction } from '../extract/extractUWorld';
import { generateMarkdownForQuestion } from '../markdown/generateMarkdown';

const QUESTIONS_ROOT = path.resolve(process.cwd(), 'uw_notes/questions');

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY が .env に設定されていません。');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  if (!fs.existsSync(QUESTIONS_ROOT)) {
    console.error(`❌ QUESTIONS_ROOT が見つかりません: ${QUESTIONS_ROOT}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(QUESTIONS_ROOT, { withFileTypes: true });
  const questionDirs = entries.filter((e) => e.isDirectory());

  if (questionDirs.length === 0) {
    console.error('❌ questions ディレクトリが空です。question.json を先に生成してください。');
    process.exit(1);
  }

  for (const dir of questionDirs) {
    const qid = dir.name;
    const dirPath = path.join(QUESTIONS_ROOT, qid);
    const jsonPath = path.join(dirPath, 'question.json');
    const mdPath = path.join(dirPath, `${qid}.md`);

    if (!fs.existsSync(jsonPath)) {
      console.warn(`⚠ question.json が見つかりません。スキップ: ${jsonPath}`);
      continue;
    }

    // 既に md があればスキップしたい場合はここでチェック
    if (fs.existsSync(mdPath)) {
      console.log(`ℹ 既に Markdown が存在します。スキップ: ${mdPath}`);
      continue;
    }

    console.log(`\n=== Generating Markdown for Question ${qid} ===`);

    const raw = fs.readFileSync(jsonPath, 'utf8');
    let question: UWorldExtraction;
    try {
      question = JSON.parse(raw) as UWorldExtraction;
    } catch (e) {
      console.error(`❌ JSON パースに失敗: ${jsonPath}`, e);
      continue;
    }

    try {
      const markdown = await generateMarkdownForQuestion(client, question, {
        model: 'gpt-4.1-mini', // コスト重視なら mini 系、精度重視なら 4.1 / 5.1
      });

      fs.writeFileSync(mdPath, markdown, 'utf8');
      console.log(`✅ Saved: ${mdPath}`);
    } catch (e) {
      console.error(`❌ Markdown 生成に失敗: Question ${qid}`, e);
    }

    // レートリミットが心配なら少し待つ
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n🎉 全ての question.json に対する Markdown 生成が完了しました。');
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
