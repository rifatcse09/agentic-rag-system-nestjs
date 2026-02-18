import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { RagModule } from './rag/rag.module';
import { ToolsModule } from './tools/tools.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AgentModule,
    RagModule,
    ToolsModule,
  ],
})
export class AppModule { }

