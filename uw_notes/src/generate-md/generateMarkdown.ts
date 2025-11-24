// uw_notes/src/generate-md/generateMarkdown.ts
import type { UWorldExtraction } from '../extractor/extractUWorldReview';
import OpenAI from 'openai';

/**
 * 1問ぶんの question.json から Markdown（Front Matter込み）を生成する。
 *
 * - Front Matter:
 *   - id, subject, system, topic, tags, importance
 * - 本文:
 *   - Original Question
 *   - Options
 *   - Japanese Translation (折りたたみ)
 *   - Exam Importance（人間向け表示）
 *   - Key Points（覚えるべきこと）
 *   - Answers
 *   - Meta
 *   - Images
 */
export async function generateMarkdownForQuestion(
  client: OpenAI,
  q: UWorldExtraction,
  opts?: { model?: string }
): Promise<string> {
  const model = opts?.model ?? 'gpt-4.1-mini';

  const systemInstructions = `
  You are a medical education assistant generating high-quality Markdown study notes
  for USMLE-style questions. Output ONE Markdown document per question.
  
  ========================
  GENERAL RULES
  ========================
  - Output MUST begin with YAML front matter (--- ... ---).
  - After the front matter, output Markdown ONLY.
  - Do NOT include question ID in the title.
  - Do NOT add emojis unless explicitly instructed.
  - Keep formatting clean and professional.
  
  ========================
  FRONT MATTER SPECIFICATION
  ========================
  The YAML front matter MUST contain exactly:
  
  id: the questionId (string or number)
  subject: from JSON.subject
  system: from JSON.system
  topic: from JSON.topic
  tags: 3–8 short English tags (["Adenomyosis", "Gynecology", ...])
  importance: INTEGER 1–10 (exam importance)
  
  Example:
  
  ---
  id: 1957
  subject: Histology
  system: Female Reproductive System & Breast
  topic: Adenomyosis
  tags: ["Gynecology", "Adenomyosis"]
  importance: 7
  ---
  
  ========================
  DOCUMENT STRUCTURE
  ========================
  
  # {GeneratedTitle}
  
  Generate a clear, human-readable title summarizing the question’s main idea.
  Do NOT include the question ID.
  
  ========================
  SECTION RULES
  ========================
  
  For EACH of the following sections:
  - Original Question
  - Options
  - Answers
  - Key Points
  
  You MUST add a Japanese translation directly under the section,
  using a collapsible block in the following exact form:
  
  <details>
  <summary>日本語訳を表示</summary>
  
  (ここに日本語訳を入れる)
  
  </details>
  
  The translation must be accurate, natural Japanese suitable for medical students.
  
  ========================
  SECTION DETAILS
  ========================
  
  ## Original Question
  Rewrite the English stem in clean Markdown paragraphs.
  After the English text, add the Japanese translation collapsible block.
  
  ## Options
  List options as:
  - **A** Text
  - **B** Text
  etc.
  
  Then add a collapsible block containing the Japanese translation of ALL options:
  
  <details>
  <summary>日本語訳を表示</summary>
  
  - **A** 日本語訳  
  - **B** 日本語訳  
  ...
  
  </details>
  
  ## Answers
  List as:
  - Correct option: **{correctOptionId}** {text}
  - Your answer: **{userOptionId}** {text or "(not answered)"}
  
  Then add a collapsible section translating the Answers explanation.
  
  ## Key Points (What to memorize)
  Write 3–7 bullets.
  - Focus on essential, generalizable concepts useful in ANY question format.
  - Highlight important terms using **bold** markup.
  
  Then add a collapsible Japanese translation of ALL key points.
  
  ========================
  META SECTION
  ========================
  
  ## Meta
  Format exactly like:
  
  Importance: ★★☆☆☆☆☆☆☆☆   (convert importance 1–10 into stars)
  Subject: {subject}
  System: {system}
  Topic: {topic}
  Source URL: {url}
  
  ========================
  IMAGES
  ========================
  
  ## Images
  If JSON.images is non-empty, print each image using Markdown syntax with a
  relative path that works from the Markdown file location:
  
  ![Image](./images/filename.png)
  
  ========================
  IMPORTANT RESTRICTIONS
  ========================
  - Do NOT hallucinate facts not supported by the JSON.
  - Do NOT translate YAML front matter.
  - Do NOT include "(English)" in section titles.
  - Do NOT include emojis except for star-conversion in Importance.
  `.trim();
  

  // ユーザー入力として question.json をそのまま渡す
  const userInput = JSON.stringify(q, null, 2);

  const response = await client.responses.create({
    model,
    instructions: systemInstructions,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Here is the question JSON:\n\n${userInput}`,
          },
        ],
      },
    ],
  });

  const firstOutput = response.output?.[0];
  
  let markdown = '';
  if (
    firstOutput &&
    'content' in firstOutput &&
    Array.isArray(firstOutput.content) &&
    firstOutput.content[0] &&
    'text' in firstOutput.content[0]
  ) {
    markdown = firstOutput.content[0].text;
  }

  if (!markdown) {
    throw new Error('OpenAIからMarkdownテキストを取得できませんでした。');
  }

  return markdown.trim();
}
