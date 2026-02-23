import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddings } from '@langchain/ollama';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

@Injectable()
export class ChatService {
  private llm!: ChatOpenAI;
  private embeddings!: OllamaEmbeddings;
  private vectorStore!: MemoryVectorStore;

  constructor(private readonly configService: ConfigService){};

  async init(): Promise<void> {
    //llm
     this.llm = new ChatOpenAI({
      model: 'deepseek/deepseek-r1:free',
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

}
