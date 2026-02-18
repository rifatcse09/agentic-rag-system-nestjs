import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SupportModule } from '../support/support.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [InventoryModule, SupportModule, CalendarModule],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule { }

