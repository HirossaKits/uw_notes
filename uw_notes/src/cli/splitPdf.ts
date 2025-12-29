import path from "node:path";
import { splitPdf as splitPdfFn } from "@/pdf/processPdf";
import { PATHS } from "@/config/paths";
import fs from "node:fs";

export async function splitPdf() {
  const masterFiles = fs.readdirSync(PATHS.PDF.MASTER);
  for (const masterFile of masterFiles) {
    await splitPdfFn(path.join(PATHS.PDF.MASTER, masterFile));
  }
}

splitPdf().catch(console.error);