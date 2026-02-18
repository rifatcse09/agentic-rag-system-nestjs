import { Injectable } from '@nestjs/common';

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
}

@Injectable()
export class RagService {
  /**
   * Placeholder implementation.
   * Later this will:
   * - embed the query,
   * - query pgvector via Prisma or SQL,
   * - return the top-k results.
   */
  async search(query: string): Promise<RagDocument[]> {
    // TODO: wire to pgvector-backed store
    return [
      {
        id: 'placeholder-doc',
        title: 'Agentic RAG System Overview',
        content: `You asked: "${query}". This is a stubbed RAG result.`,
        source: 'stub',
      },
    ];
  }
}

