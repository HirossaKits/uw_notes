import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is missing in .env');
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function crateEmbedding(text: string): Promise<number[]> {
  const embedding = await client.embeddings.create({
    input: text,
    model: "text-embedding-3-large",
  })
  return embedding.data[0].embedding;
}