import { Injectable } from '@nestjs/common';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { RagService } from '../rag/rag.service';
import { ToolsService } from '../tools/tools.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly ragService: RagService,
    private readonly toolsService: ToolsService,
  ) { }

  /**
   * Very simplified orchestration logic:
   * - Uses RAG to fetch context for the message.
   * - Optionally calls a tool based on naive pattern matching.
   * - Returns a structured response.
   *
   * In a real implementation this would be handled by LangChain.js / LangGraph
   * with a ReAct-style agent loop and Gemini as the LLM.
   */
  async handleChat(request: ChatRequestDto): Promise<ChatResponseDto> {
    const { message } = request;

    const context = await this.ragService.search(message);

    const toolCalls: ChatResponseDto['toolCalls'] = [];

    if (/inventory|stock|available/i.test(message)) {
      await this.toolsService.checkInventory({ query: message });
      toolCalls.push({ tool: 'check_inventory', success: true });
    }

    const response: ChatResponseDto = {
      message:
        'This is a placeholder response from the Agent orchestrator. ' +
        'RAG and tool calls will be wired to Gemini + LangChain/LangGraph in the next step.\n\n' +
        `Retrieved ${context.length} knowledge item(s) as context.`,
      sources: context.map((doc) => ({
        id: doc.id,
        title: doc.title,
      })),
      toolCalls,
    };

    return response;
  }
}

