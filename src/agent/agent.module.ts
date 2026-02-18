import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RagModule } from '../rag/rag.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [RagModule, ToolsModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule { }

