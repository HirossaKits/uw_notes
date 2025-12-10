import path from "node:path";
import fs from "node:fs";
import { publishToNotion } from "@/publish/notion/publish";

export async function publish() {
  const root = "uw_notes/questions";
  const folders = fs.readdirSync(root);

  for (const folder of folders) {
    const mdPath = path.join(root, folder, `${folder}.md`);
    if (fs.existsSync(mdPath)) {
      await publishToNotion(mdPath);
    }
  }
}