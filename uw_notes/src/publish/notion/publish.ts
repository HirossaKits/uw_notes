import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@notionhq/client";
import type { BlockObjectRequest, BlockObjectRequestWithoutChildren, FileUploadObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";
import { markdownToBlocks } from "@tryfabric/martian";
import sharp, { block } from 'sharp';
import { json } from "node:stream/consumers";

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
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg'
  };
  return types[ext || ''] || 'application/octet-stream';
}

/**
 * Compress image to fit within maxSize (in bytes)
 */
async function compressImage(
  filePath: string,
  maxSize: number = 5 * 1024 * 1024
): Promise<Buffer> {
  const stats = fs.statSync(filePath);
  
  if (stats.size <= maxSize) {
    return fs.readFileSync(filePath);
  }

  let quality = 80;
  let buffer = await sharp(filePath)
    .jpeg({ quality })
    .toBuffer();

  while (buffer.length > maxSize && quality > 10) {
    quality -= 10;
    buffer = await sharp(filePath)
      .jpeg({ quality })
      .toBuffer();
  }

  return buffer;
}


/**
 * Upload image to Notion
 */
async function uploadImage(filePath:string): Promise<string> {
  const fileName = path.basename(filePath);
  const mimeType = getMimeType(filePath);
  const compressedBuffer = await compressImage(filePath);

  const fileUpload = await notion.fileUploads.create({
    mode: 'single_part',
  });

  const send = await notion.fileUploads.send({
    file_upload_id: fileUpload.id,
    file: {
      filename: fileName,
      data: new Blob([Buffer.from(compressedBuffer)], { type: mimeType }),
    },
  });

  return send.id;
}

/**
 * Upload images and replace paths
 */
async function uploadImagesAndReplacePaths(
  blocks: BlockObjectRequest[],
  imageDir: string
): Promise<BlockObjectRequest[]> {
  const imageRegex = /(\.\/images\/[^\s\)]+)/;
  const updatedBlocks = await Promise.all([...blocks].map(async (block) => {
    if (block.type !== "paragraph") {
      return block;
    }

    if (!block.paragraph.rich_text || block.paragraph.rich_text.length === 0) {
      return block;
    }

    if (block.paragraph.rich_text[0].type !== "text") {
      return block;
    }

    const match = imageRegex.exec(block.paragraph.rich_text[0].text.content);
    if (match !== null) {
      const filename = path.join(imageDir, match[1]);
      if (!fs.existsSync(filename)) return block;
      console.log(`📤 Uploading: ${filename}`);
      const uploadedFileId = await uploadImage(filename);

      return {
        object: "block",
        type: "image",
        image: {
          type: "file_upload",
          file_upload: { id: uploadedFileId }
        }
      } as BlockObjectRequest;
    }
    return block;
  }));
  return updatedBlocks;
}


/**
 * Remove children property from BlockObjectRequest to create BlockObjectRequestWithoutChildren
 */
function removeChildrenFromBlock(
  block: BlockObjectRequest
): BlockObjectRequestWithoutChildren {
  const blockCopy = JSON.parse(JSON.stringify(block));
  delete blockCopy.children;
  return blockCopy;
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
      toggleChildren.push(removeChildrenFromBlock(blocks[i]));
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

  // Extract front matter
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

  // Remove front matter
  markdown = markdown.replace(/^---[\s\S]+?---/, "").trim();

  // PREPROCESS details → H3
  markdown = preprocessMarkdown(markdown);

  // Convert markdown → notion blocks
  const notionBlocks = markdownToBlocks(markdown) as BlockObjectRequest[];

  // Upload images and replace paths
  const imageDir = path.dirname(mdPath);
  const updatedBlocks = await uploadImagesAndReplacePaths(notionBlocks, imageDir);

  // Convert H3 → toggle (robust version)
  const finalBlocks = convertHeadingToToggle(updatedBlocks);


  // Title
  const firstLine =
    markdown.split("\n").find((l) => l.startsWith("# "))?.replace(/^#\s*/, "") ||
    topic ||
    "Untitled";

  // Upload to Notion
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
    children: updatedBlocks,
  });

  if ("url" in response) {
  console.log("✔ Published:", response.url);
  } 
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
