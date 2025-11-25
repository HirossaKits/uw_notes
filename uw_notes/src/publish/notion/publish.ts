import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";
import { markdownToBlocks } from "@tryfabric/martian";

dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN) {
  throw new Error("❌ NOTION_TOKEN is missing in .env");
}
if (!NOTION_DATABASE_ID) {
  throw new Error("❌ NOTION_DATABASE_ID is missing in .env");
}

const notion = new Client({ auth: NOTION_TOKEN });

/**
 * Parse YAML front matter manually
 */
function extractYamlFrontMatter(markdown: string): Record<string, any> {
  const match = markdown.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return {};

  const yamlBlock = match[1];
  const result: Record<string, any> = {};

  yamlBlock.split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (!key) return;
    result[key.trim()] = rest.join(":").trim();
  });

  return result;
}

/**
 * Publish ONE question folder:
 * - markdown
 * - images/
 */
export async function publishToNotion(mdPath: string) {
  console.log(`\n📤 Publishing: ${mdPath}`);

  if (!fs.existsSync(mdPath)) {
    throw new Error(`Markdown not found: ${mdPath}`);
  }

  const markdown = fs.readFileSync(mdPath, "utf8");

  // -------------------------
  // 1. Parse YAML Front Matter
  // -------------------------
  const front = extractYamlFrontMatter(markdown);

  const id = front["id"];
  const subject = front["subject"];
  const system = front["system"];
  const topic = front["topic"];
  const tagsRaw = front["tags"];
  const importance = Number(front["importance"] || 0);
  const url = front["sourceUrl"] || front["url"] || null;

  const tags = tagsRaw
    ? tagsRaw.replace("[", "").replace("]", "").split(",")
        .map((t) => t.replace(/"/g, "").trim())
    : [];

  // -------------------------
  // 2. Clean markdown (remove YAML block)
  // -------------------------
  const cleanedMarkdown = markdown.replace(/^---[\s\S]+?---/, "").trim();

  // -------------------------
  // 3. Convert markdown → Notion blocks
  // -------------------------
  const blocks = (await markdownToBlocks(cleanedMarkdown)) as BlockObjectRequest[];

  // -------------------------
  // 4. Title = first H1
  // -------------------------
  const firstLine = cleanedMarkdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s*/, "")
    .trim() || topic || "Untitled";

  console.log(`→ 📝 Notion Title: ${firstLine}`);

  // -------------------------
  // 5. Create page in Notion
  // -------------------------
  const response = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: {
        title: [{ text: { content: firstLine } }],
      },
      Subject: subject
        ? { rich_text: [{ text: { content: subject } }] }
        : undefined,
      System: system
        ? { rich_text: [{ text: { content: system } }] }
        : undefined,
      Topic: topic
        ? { rich_text: [{ text: { content: topic } }] }
        : undefined,
      Importance: {
        number: importance,
      },
      Tags: {
        multi_select: tags.map((t) => ({ name: t })),
      },
      Source: url ? { url } : undefined,
      QuestionId: id ? { number: Number(id) } : undefined,
    },
    children: blocks,
  });

  const pageUrl =
    "url" in response
      ? response.url
      : `https://notion.so/${response.id.replace(/-/g, "")}`;

  console.log(`✔ Published: ${pageUrl}\n`);

  return pageUrl;
}

/**
 * MAIN — publish all questions in uw_notes/questions/{id}/{id}.md
 */
async function main() {
  const questionsRoot = path.resolve("uw_notes/questions");

  if (!fs.existsSync(questionsRoot)) {
    console.error("❌ questions directory not found.");
    process.exit(1);
  }

  const folders = fs.readdirSync(questionsRoot);

  for (const folder of folders) {
    const mdPath = path.join(questionsRoot, folder, `${folder}.md`);
    if (fs.existsSync(mdPath)) {
      await publishToNotion(mdPath);
    } else {
      console.warn(`⚠ No markdown found for question ${folder}`);
    }
  }

  console.log("🎉 All questions published to Notion!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
