import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
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
  private llm!: ChatOllama;
  private embeddings!: OllamaEmbeddings;
  private vectorStore!: MemoryVectorStore;

  constructor(private readonly configService: ConfigService) { }

  /** Ensures LLM, embeddings, and vector store are initialized (e.g. before first ingest/query). */
  private async ensureInit(): Promise<void> {
    if (this.vectorStore != null) return;
    await this.init();
  }

  async init(): Promise<void> {
    // LLM via Ollama (local). Ensure: 1) Ollama is running (e.g. ollama serve).
    // 2) Model is pulled: ollama pull llama3.2:3b (or ollama list to see names).
    const ollamaBaseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
    const chatModel =
      this.configService.get<string>('CHAT_OLLAMA_MODEL') ?? 'llama3.2:3b';
    this.llm = new ChatOllama({
      model: chatModel,
      baseUrl: ollamaBaseUrl,
      temperature: 0,
    });


    //embeddings via ollama (share same baseUrl; model overridable via env)
    const embeddingsModel =
      this.configService.get<string>('EMBEDDINGS_OLLAMA_MODEL') ??
      'mxbai-embed-large';
    this.embeddings = new OllamaEmbeddings({
      model: embeddingsModel,
      baseUrl: ollamaBaseUrl,
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
    // Fetch more chunks (k=8) so broad questions like "Who is X?" get the right passage; was k=4.
    const retrievalK = this.configService.get<number>('RAG_RETRIEVAL_K') ?? 8;
    const retriever = this.vectorStore.asRetriever({
      k: retrievalK,
      searchType: 'similarity',
    });

    // --- RAG prompt ---
    // Answer based only on the retrieved context, but allow reasonable summarization/inference from it.
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        "Answer strictly from the provided context. If unknown, say you dont know",
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
