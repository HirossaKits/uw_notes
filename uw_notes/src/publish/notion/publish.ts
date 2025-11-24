import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from '@notionhq/client';
import matter from 'gray-matter';

const QUESTIONS_ROOT = path.resolve(process.cwd(), 'uw_notes/questions');

async function main() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!databaseId) {
    console.error('❌ NOTION_DATABASE_ID が .env にありません');
    process.exit(1);
  }

  const dirs = fs.readdirSync(QUESTIONS_ROOT, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const qid = dir.name;
    const mdPath = path.join(QUESTIONS_ROOT, qid, `${qid}.md`);

    if (!fs.existsSync(mdPath)) {
      console.log(`⚠ Markdown がないのでスキップ: ${mdPath}`);
      continue;
    }

    const raw = fs.readFileSync(mdPath, 'utf8');
    const parsed = matter(raw); // YAML + body に分割

    const fm = parsed.data;
    const body = parsed.content;

    console.log(`📤 Notion に送信中: Question ${fm.id} (${qid})`);

    // 既存ページがあるか確認
    const existing = await notion.search({
      filter: {
        property: 'object',
        value: 'page',
      },
      query: String(fm.id),
    });

    if (existing.results.length > 0) {
      const pageId = existing.results[0].id;

      console.log(`🔄 更新: Page ${pageId}`);

      await notion.pages.update({
        page_id: pageId,
        properties: {
          Name: { title: [{ text: { content: fm.topic || `Q${fm.id}` } }] },
          id: { rich_text: [{ text: { content: String(fm.id) } }] },
          subject: { rich_text: [{ text: { content: fm.subject || '' } }] },
          system: { rich_text: [{ text: { content: fm.system || '' } }] },
          topic: { rich_text: [{ text: { content: fm.topic || '' } }] },
          importance: { number: fm.importance || 0 },
          tags: {
            multi_select: (fm.tags || []).map((t: string) => ({ name: t })),
          },
          markdown: { rich_text: [{ text: { content: body } }] },
        },
      });
    } else {
      console.log(`➕ 新規作成`);

      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: fm.topic || `Q${fm.id}` } }] },
          id: { rich_text: [{ text: { content: String(fm.id) } }] },
          subject: { rich_text: [{ text: { content: fm.subject || '' } }] },
          system: { rich_text: [{ text: { content: fm.system || '' } }] },
          topic: { rich_text: [{ text: { content: fm.topic || '' } }] },
          importance: { number: fm.importance || 0 },
          tags: {
            multi_select: (fm.tags || []).map((t: string) => ({ name: t })),
          },
          markdown: { rich_text: [{ text: { content: body } }] },
        },
      });
    }
  }

  console.log('\n🎉 Notion への同期が完了しました！');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
