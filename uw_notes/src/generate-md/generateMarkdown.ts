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
You are a medical education assistant helping to create high-quality study notes
for USMLE-style questions. You will receive a JSON object describing a single
question, and you must output ONE Markdown document.

Requirements:

1. Use YAML front matter at the top with EXACTLY these fields:
   - id: the questionId as number or string
   - subject: from JSON.subject (string, unchanged)
   - system: from JSON.system (string, unchanged)
   - topic: from JSON.topic (string, unchanged)
   - tags: a YAML list of 3-8 short English tags (e.g. ["Gynecology", "Adenomyosis"])
   - importance: an INTEGER between 1 and 10 (estimated exam importance)

2. After the front matter, output the body in Markdown with this structure
   (no extra emojis, no extra sections):

   # Q{id} — {topic}

   ## Original Question (English)
   - Rewrite the question stem in clean Markdown paragraphs.
   - Preserve all clinically relevant details.

   ## Options
   - List options as:
     - **A** Text...
     - **B** Text...
     etc.
   - Use the optionId and optionText fields.

   ## Japanese Translation
   Wrap the entire Japanese translation in a collapsible section using:
   <details>
   <summary>日本語訳を表示</summary>

   （ここに質問文と選択肢の日本語訳を書く）

   </details>

   - Translation should be natural Japanese suitable for a medical student.
   - Do NOT translate the YAML front matter or headings.

   ## Exam Importance
   - Show the importance as "Importance: X/10".
   - Optionally add 1 short line why (e.g. "Common high-yield gynecology topic").

   ## Key Points (What to memorize)
   - Write 3-7 bullet points.
   - Focus on what should be remembered to answer similar questions in ANY format
     (single best answer, multiple true-false, fill-in-the-blank, etc.).
   - Emphasize pathophysiology, hallmark findings, and rule-outs.

   ## Answers
   - Show:
     - Correct option: {correctOptionId} and its text
     - Your answer: {userOptionId} and its text
   - If userOptionId is null, mention that the question was not answered.

   ## Meta
   - Subject
   - System
   - Topic
   - Source URL

   ## Images
   - If JSON.images is non-empty, list them as:
     - images/explanation_0.png
     etc.
   - DO NOT attempt to render the actual image in Markdown here; just list the paths.

3. Very important:
   - Output MUST be valid Markdown with a single YAML front matter block at top.
   - Do NOT invent content not supported by the JSON.
   - Japanese translation should be accurate and concise.
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
