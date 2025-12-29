import fs from "node:fs";
import { publishToNotion } from "@/publish/notion/publish";
import { PATHS } from "@/config/paths";

export async function publish() {
  const root = PATHS.QUESTIONS;
  const folders = fs.readdirSync(root);

  for (const folder of folders) {
    const mdPath = PATHS.questionMarkdown(folder);
    if (fs.existsSync(mdPath)) {
      await publishToNotion(mdPath);
    }
  }
}

publish().catch(console.error);