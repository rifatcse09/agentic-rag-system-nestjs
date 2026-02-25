import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { IngestBodyDto } from './dto/ingest.dto';
import { Document } from '@langchain/core/documents';
import { loadPdfAsDocuments } from './helper/pdf.loader';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class ChatService {
  private llm!: ChatOpenAI;
  private embeddings!: OllamaEmbeddings;
  private vectorStore!: MemoryVectorStore;

  constructor(private readonly configService: ConfigService) { };

  async init(): Promise<void> {
    //llm
    this.llm = new ChatOpenAI({
      model: 'deepseek/deepseek-r1',
      apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
      configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      temperature: 0,
    });


    //embeddings via ollama
    this.embeddings = new OllamaEmbeddings({
      model: 'mxbai-embed-large',
      baseUrl: 'http://localhost:11434',
    });

    //vector store
    this.vectorStore = new MemoryVectorStore(this.embeddings);
  }

  async ingest(body: IngestBodyDto) {
    const textDocs: Document[] = (body.docs || []).map(
      (d) =>
        new Document({
          pageContent: d.content,
          metadata: { source: d.meta?.source ?? 'inline', ...d.meta },
        }),
    );

    const pdfDocs: Document[] = [];
    for (const p of body.pdfPaths || []) {
      const docs = await loadPdfAsDocuments(p);
      pdfDocs.push(...docs);
    }

    const allDocs = [...textDocs, ...pdfDocs];
    if (allDocs.length === 0) {
      return {
        success: false,
        message: 'No documents provided',
        chunksAdded: 0,
      };
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 150,
      separators: ['\n\n', '\n', ' ', ''],
    });

    const splitDocs = await splitter.splitDocuments(allDocs);
    await this.vectorStore.addDocuments(splitDocs);

    return {
      success: true,
      message: 'Documents ingested',
      chunksAdded: splitDocs.length,
      documentsProcessed: allDocs.length,
      pdfsProcessed: (body.pdfPaths || []).length,
    };
  }

  async handleFileUpload(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return {
        success: false,
        message: 'No files uploaded',
        chunksAdded: 0,
      };
    }

    const filePaths = files.map((file) => file.path);

    const result = await this.ingest({ pdfPaths: filePaths });

    return {
      ...result,
      uploadedFiles: files.map((f) => f.originalname),
    };
  }

  async query(question: string) {
    if (!question?.trim()) {
      return {
        success: false,
        message: 'Question cannot be empty',
        answer: '',
        sources: [],
      };
    }

    const retriever = this.vectorStore.asRetriever({
      k: 4,
      searchType: 'similarity',
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Answer strictly from the provided context. If unknown, say you dont know',
      ],
      ['human', 'Question:\n{question}\n\nContext:\n{context}'],
    ]);

    const ragChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt,
      outputParser: new StringOutputParser(),
    });

    const contextDocs = await retriever.invoke(question);

    if (contextDocs.length === 0) {
      return {
        success: false,
        answer: 'No indexed content yet.Please ingest document first.',
        sources: [],
        contextCount: 0,
      };
    }

    const answer = await ragChain.invoke({ question, context: contextDocs });

    const sources = Array.from(
      new Set(
        contextDocs.map((d) => d.metadata?.source).filter(Boolean) as string[],
      ),
    ).slice(0, 10);

    return {
      success: true,
      answer,
      sources,
      contextCount: contextDocs.length,
    };
  }

}
