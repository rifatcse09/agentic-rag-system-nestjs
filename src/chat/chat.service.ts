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
import { resolve } from 'path';

@Injectable()
export class ChatService {
  private llm!: ChatOpenAI;
  private embeddings!: OllamaEmbeddings;
  private vectorStore!: MemoryVectorStore;

  constructor(private readonly configService: ConfigService) { }

  /** Ensures LLM, embeddings, and vector store are initialized (e.g. before first ingest/query). */
  private async ensureInit(): Promise<void> {
    if (this.vectorStore != null) return;
    await this.init();
  }

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
    await this.ensureInit();

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

    const filePaths = files.map((file) => resolve(file.path));

    const result = await this.ingest({ pdfPaths: filePaths });

    return {
      ...result,
      uploadedFiles: files.map((f) => f.originalname),
    };
  }

  /**
   * RAG query: retrieve relevant chunks from the vector store, then generate an answer
   * using only that context so responses stay grounded in ingested documents.
   */
  async query(question: string) {
    await this.ensureInit();

    // --- Input validation ---
    // Reject empty/whitespace-only questions to avoid wasted retrieval and LLM calls.
    if (!question?.trim()) {
      return {
        success: false,
        message: 'Question cannot be empty',
        answer: '',
        sources: [],
      };
    }

    // --- Retriever setup ---
    // Turn the vector store into a retriever: k=4 fetches the 4 most similar chunks;
    // similarity search finds chunks whose embeddings are closest to the question embedding.
    const retriever = this.vectorStore.asRetriever({
      k: 4,
      searchType: 'similarity',
    });

    // --- RAG prompt ---
    // System message constrains the LLM to answer only from context (reduces hallucination).
    // Human template injects the user question and the retrieved context for the model to read.
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Answer strictly from the provided context. If unknown, say you dont know',
      ],
      ['human', 'Question:\n{question}\n\nContext:\n{context}'],
    ]);

    // --- Chain assembly ---
    // createStuffDocumentsChain "stuffs" all retrieved docs into the {context} variable
    // and runs the LLM once. StringOutputParser gives a plain string answer instead of a message object.
    const ragChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt,
      outputParser: new StringOutputParser(),
    });

    // --- Retrieve context ---
    // Embed the question and fetch the k nearest document chunks from the vector store.
    const contextDocs = await retriever.invoke(question);

    // --- No context guard ---
    // If nothing was ingested or nothing matches, we cannot answer. MemoryVectorStore is in-memory
    // so the index is cleared on every server restart—re-upload/re-ingest after restart.
    if (contextDocs.length === 0) {
      return {
        success: false,
        answer:
          'No indexed content yet. Please ingest documents first (e.g. POST /chat/upload). ' +
          'Note: the index is in-memory and is cleared when the server restarts.',
        sources: [],
        contextCount: 0,
      };
    }

    // --- Generate answer ---
    // Pass question and retrieved docs to the chain; the chain formats context and gets one LLM response.
    const answer = await ragChain.invoke({ question, context: contextDocs });

    // --- Source attribution ---
    // Collect unique source paths from chunk metadata (e.g. PDF filenames), dedupe with Set,
    // and cap at 10 so the response payload stays bounded.
    const sources = Array.from(
      new Set(
        contextDocs.map((d) => d.metadata?.source).filter(Boolean) as string[],
      ),
    ).slice(0, 10);

    // --- Success response ---
    // Return the answer, list of sources used, and how many chunks were in context (for transparency).
    return {
      success: true,
      answer,
      sources,
      contextCount: contextDocs.length,
    };
  }

}
