import * as path from 'node:path';
import { analyzePdf as analyzePdfFn } from "@/pdf/analyzePdf";
import fs from 'node:fs';

async function analyzePdf() {
  const pdfPath = path.join(process.cwd(), 'public', 'usml_2024_20.pdf');
  console.log('📄 Analyzing PDF...');
  const result = await analyzePdfFn(pdfPath);
  const outputPath = path.join(path.dirname(pdfPath), path.basename(pdfPath, '.pdf') + '.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

analyzePdf().catch(console.error);