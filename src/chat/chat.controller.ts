import { Controller, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController implements OnModuleInit {
  constructor(private readonly chatService: ChatService) { }

  async onModuleInit() {
    await this.chatService.init();
    console.log('Chat service initialized');
  }
}
