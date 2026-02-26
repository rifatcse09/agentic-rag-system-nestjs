import { Document } from '@langchain/core/documents';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { readFileSync } from 'fs';

/**
 * Extract AcroForm field values directly from the raw PDF bytes.
 * Fillable invoice PDFs store data in /V entries, not in the text stream.
 */
function extractAcroFormValues(filePath: string): string[] {
  const raw = readFileSync(filePath, 'latin1');
  return [...raw.matchAll(/\/V\s*\(([^)]*)\)/g)]
    .map((m) => m[1].trim())
    .filter((v) => v.length > 0);
}

/**
 * Detect if a PDF is a fillable form with blank template text.
 * Checks: has AcroForm fields AND text is dominated by underscores/blanks.
 */
function isBlankFormPdf(filePath: string, extractedText: string): boolean {
  const raw = readFileSync(filePath, 'latin1');
  const hasAcroForm = raw.includes('/AcroForm');
  if (!hasAcroForm) return false;

  const underscoreCount = (extractedText.match(/_/g) || []).length;
  return underscoreCount > 20;
}

/**
 * Clean fragmented PDF text. pdf-parse often splits tokens across lines
 * (e.g. "INV\n-\n100" instead of "INV-100"). This rejoins them.
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/\n\s*\n/g, '\n')       // collapse multiple blank lines
    .replace(/\n([:\-,.])\n/g, '$1 ') // rejoin split punctuation
    .replace(/\n([:\-,.])/g, '$1')    // rejoin trailing punctuation
    .replace(/([:\-,.])\n/g, '$1 ')   // rejoin leading punctuation
    .replace(/(\w)- (\w)/g, '$1-$2')  // fix "INV- 100" → "INV-100"
    .replace(/(\d)\n(\d)/g, '$1$2')   // fix split numbers "20\n19" → "2019"
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function loadPdfAsDocuments(
  filePath: string,
): Promise<Document[]> {
  const loader = new PDFLoader(filePath, {
    splitPages: false,
    parsedItemSeparator: '\n',
  });
  const docs = await loader.load();
  const baseText = docs.map((d) => d.pageContent).join('\n');

  let finalText: string;

  if (isBlankFormPdf(filePath, baseText)) {
    const formValues = [...new Set(extractAcroFormValues(filePath))];
    finalText = formValues.length > 0
      ? formValues.join('\n')
      : baseText;
  } else {
    finalText = cleanExtractedText(baseText);
  }

  return [
    new Document({
      pageContent: finalText,
      metadata: { source: filePath },
    }),
  ];
}