import { Document } from '@langchain/core/documents';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function loadPdfAsDocuments(
  filePath: string,
): Promise<Document[]> {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  return docs.map(
    (d) =>
      new Document({
        pageContent: d.pageContent,
        metadata: { ...(d.metadata || {}), source: filePath },
      }),
  );
}