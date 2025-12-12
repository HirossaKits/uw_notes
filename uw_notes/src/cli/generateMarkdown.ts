import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import OpenAI from 'openai';
import type { UWorldExtraction } from '../extract/extractUWorld';
import { generateMarkdownForQuestion } from '../markdown/generateMarkdown';

const QUESTIONS_ROOT = path.resolve(process.cwd(), 'uw_notes/questions');

async function generateMarkdown() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set in .env');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  if (!fs.existsSync(QUESTIONS_ROOT)) {
    console.error(`❌ QUESTIONS_ROOT not found: ${QUESTIONS_ROOT}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(QUESTIONS_ROOT, { withFileTypes: true });
  const questionDirs = entries.filter((e) => e.isDirectory());

  if (questionDirs.length === 0) {
    console.error('❌ questions directory is empty. Please generate question.json first.');
    process.exit(1);
  }

  for (const dir of questionDirs) {
    const qid = dir.name;
    const dirPath = path.join(QUESTIONS_ROOT, qid);
    const jsonPath = path.join(dirPath, 'question.json');
    const mdPath = path.join(dirPath, `${qid}.md`);

    if (!fs.existsSync(jsonPath)) {
      console.warn(`⚠ question.json not found. Skipping: ${jsonPath}`);
      continue;
    }

    // Skip if markdown already exists
    if (fs.existsSync(mdPath)) {
      console.log(`ℹ Markdown already exists. Skipping: ${mdPath}`);
      continue;
    }

    console.log(`\n=== Generating Markdown for Question ${qid} ===`);

    const raw = fs.readFileSync(jsonPath, 'utf8');
    let question: UWorldExtraction;
    try {
      question = JSON.parse(raw) as UWorldExtraction;
    } catch (e) {
      console.error(`❌ Failed to parse JSON: ${jsonPath}`, e);
      continue;
    }

    try {
      const markdown = await generateMarkdownForQuestion(client, question, {
        model: 'gpt-4.1-mini', // Use mini for cost efficiency, 4.1/5.1 for accuracy
      });

      fs.writeFileSync(mdPath, markdown, 'utf8');
      console.log(`✅ Saved: ${mdPath}`);
    } catch (e) {
      console.error(`❌ Failed to generate Markdown: Question ${qid}`, e);
    }

    // Wait to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('\n🎉 Markdown generation completed for all question.json files.');
}

generateMarkdown().catch(console.error);