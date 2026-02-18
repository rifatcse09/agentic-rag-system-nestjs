export class ChatResponseDto {
  message: string;
  sources?: Array<{
    id: string;
    title: string;
  }>;
  toolCalls?: Array<{
    tool: string;
    success: boolean;
  }>;
}

