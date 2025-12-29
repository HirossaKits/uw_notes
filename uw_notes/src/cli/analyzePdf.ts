import * as path from 'node:path';
import { analyzePdf as analyzePdfFn } from "@/pdf/analyzePdf";
import { PATHS } from "@/config/paths";
import fs from 'node:fs';

async function analyzePdf() {
  const pdfFiles = fs.readdirSync(PATHS.PDF.CHUNK);
  for (const pdfFile of pdfFiles) {
    console.log(`📄 Analyzing PDF: ${pdfFile}`);
    const result = await analyzePdfFn(path.join(PATHS.PDF.CHUNK, pdfFile));
    const outputPath = path.join(PATHS.JSON, path.basename(pdfFile, '.pdf') + '.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  }
}

analyzePdf().catch(console.error);