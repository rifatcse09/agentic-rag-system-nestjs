import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { RagModule } from './rag/rag.module';
import { ToolsModule } from './tools/tools.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AgentModule,
    RagModule,
    ToolsModule,
    ChatModule,
  ],
})
export class AppModule { }

