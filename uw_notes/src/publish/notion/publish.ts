import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  BlockObjectRequestWithoutChildren,
} from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";
import { markdownToBlocks } from "@tryfabric/martian";

dotenv.config();

const NOTION_TOKEN = process.env.NOTION_TOKEN!;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID!;

if (!NOTION_TOKEN) throw new Error("❌ NOTION_TOKEN is missing in .env");
if (!NOTION_DATABASE_ID) throw new Error("❌ NOTION_DATABASE_ID is missing in .env");

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

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const types: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
  };
  return types[ext || ''] || 'application/octet-stream';
}

/**
 * Convert markdown image tags into Notion image blocks (base64)
 */
function extractImageBlocks(
  md: string,
  imageDir: string
): { cleanedMarkdown: string; imageBlocks: BlockObjectRequest[] } {
  const imageRegex = /!\[.*?\]\((\.\/images\/[^\)]+)\)/g;

  let cleanedMarkdown = md;
  const imageBlocks: BlockObjectRequest[] = [];

  let match;
  while ((match = imageRegex.exec(md)) !== null) {
    const relPath = match[1];            // "./images/xxx.png"
    const absPath = path.join(imageDir, relPath);

    if (!fs.existsSync(absPath)) continue;

    const mime = getMimeType(absPath);
    const base64 = fs.readFileSync(absPath).toString("base64");

    // Create image block
    imageBlocks.push({
      object: "block",
      type: "image",
      image: {
        type: "file",
        file: {
          url: `data:${mime};base64,${base64}`
        }
      }
    });

    // Remove the markdown line containing the image
    cleanedMarkdown = cleanedMarkdown.replace(match[0], "");
  }

  return { cleanedMarkdown, imageBlocks };
}

/**
 * Convert <details> to H3 placeholder
 */
function preprocessMarkdown(md: string): string {
  return md.replace(
    /<details>\s*<summary>日本語訳を表示<\/summary>\s*([\s\S]*?)<\/details>/g,
    (_m, inner) => `### 日本語訳を表示\n\n${inner.trim()}\n`
  );
}

/**
  Convert H3 to Notion toggle
*/
function convertHeadingToToggle(blocks: BlockObjectRequest[]): BlockObjectRequest[] {
  const output: BlockObjectRequest[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    const isTarget =
      block.type === "heading_3" &&
      block.heading_3?.rich_text?.[0]?.type === "text" &&
      block.heading_3?.rich_text?.[0]?.text?.content === "日本語訳を表示";

    if (!isTarget) {
      output.push(block);
      i++;
      continue;
    }

    const toggleChildren: BlockObjectRequestWithoutChildren[] = [];
    i++;

    while (
      i < blocks.length &&
      !(blocks[i].type === "heading_2" || blocks[i].type === "heading_3")
    ) {
      const copy = JSON.parse(JSON.stringify(blocks[i]));
      delete copy.children;
      toggleChildren.push(copy);
      i++;
    }

    output.push({
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "日本語訳を表示" } }],
        children: toggleChildren,
      },
    });
  }

  return output;
}

/**
 * Publish one markdown
 */
export async function publishToNotion(mdPath: string) {
  console.log(`\n📤 Publishing: ${mdPath}`);

  let markdown = fs.readFileSync(mdPath, "utf8");

  const front = extractYamlFrontMatter(markdown);
  const id = front["id"];
  const subject = front["subject"];
  const system = front["system"];
  const topic = front["topic"];
  const tagsRaw = front["tags"];
  const importance = Number(front["importance"] || 0);
  const url = front["sourceUrl"] || front["url"] || null;

  const tags = tagsRaw
    ? tagsRaw.replace("[", "").replace("]", "").split(",").map((t) => t.replace(/"/g, "").trim())
    : [];

  markdown = markdown.replace(/^---[\s\S]+?---/, "").trim();

  markdown = preprocessMarkdown(markdown);

  // -------- IMAGE PROCESSING (New) --------
  const imageDir = path.dirname(mdPath);
  const { cleanedMarkdown, imageBlocks } = extractImageBlocks(markdown, imageDir);

  // -------- MARKDOWN → BLOCKS --------
  const notionBlocks = markdownToBlocks(cleanedMarkdown) as BlockObjectRequest[];

  const finalBlocks = convertHeadingToToggle(notionBlocks);

  // 画像ブロックを最後に追加（順序を維持）
  finalBlocks.push(...imageBlocks);

  const firstLine =
    cleanedMarkdown.split("\n").find((l) => l.startsWith("# "))?.replace(/^#\s*/, "") ||
    topic ||
    "Untitled";

  const response = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: { title: [{ text: { content: firstLine } }] },
      Subject: subject ? { rich_text: [{ text: { content: subject } }] } : undefined,
      System: system ? { rich_text: [{ text: { content: system } }] } : undefined,
      Topic: topic ? { rich_text: [{ text: { content: topic } }] } : undefined,
      Importance: { number: importance },
      Tags: { multi_select: tags.map((t) => ({ name: t })) },
      Source: url ? { url } : undefined,
      QuestionId: id ? { number: Number(id) } : undefined,
    },
    children: finalBlocks,
  });

  console.log("✔ Published:", response.url);
}

/**
 * MAIN — publish all markdowns
 */
async function main() {
  const root = "uw_notes/questions";
  const folders = fs.readdirSync(root);

  for (const folder of folders) {
    const mdPath = path.join(root, folder, `${folder}.md`);
    if (fs.existsSync(mdPath)) {
      await publishToNotion(mdPath);
    }
  }
}

main().catch(console.error);
