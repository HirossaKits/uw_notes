import * as fs from 'node:fs';
import * as path from 'node:path';
import { UWorldExtraction } from '@/extractor/extractUWorldReview';

export function saveExtraction(id: string, data: UWorldExtraction) {
  const OUT_DIR = path.resolve(process.cwd(), 'uw_notes');
  const jsonPath = path.join(OUT_DIR, `${id}.json`);
  const mdPath = path.join(OUT_DIR, `${id}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  const md = [
    `# UWorld – ${id}`,
    `> source: ${data.url}`,
    `## 🧠 Question\n${data.stem || ''}`,
    `## 📝 Options`,
    ...data.options.map(o => `- ${o.id}. ${o.text}`),
    `## 🧩 Explanation\n${data.explanation || ''}`,
    `## 🖼 Images`,
    ...data.images.map(img => `![img](${img})`)
  ].join('\n\n');

  fs.writeFileSync(mdPath, md);

  console.log('Saved:', jsonPath);
  console.log('Saved:', mdPath);
}
