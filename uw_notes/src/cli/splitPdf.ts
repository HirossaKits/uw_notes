import path from "node:path";
import { splitPdf as splitPdfFn } from "@/pdf/processPdf";

export async function splitPdf() {
  const pdfPath = path.join(process.cwd(), 'public', 'usml_2024_20.pdf');
  await splitPdfFn(pdfPath,1);
}

splitPdf().catch(console.error);