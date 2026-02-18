import { Injectable } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { SupportService } from '../support/support.service';
import { CalendarService } from '../calendar/calendar.service';

interface CheckInventoryInput {
  query: string;
}

@Injectable()
export class ToolsService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly supportService: SupportService,
    private readonly calendarService: CalendarService,
  ) { }

  /**
   * Inventory tool – delegates to InventoryModule.
   */
  async checkInventory(input: CheckInventoryInput): Promise<void> {
    await this.inventoryService.findStock(input);
  }

  /**
   * Support ticket tool – delegates to SupportModule.
   */
  async createSupportTicket(payload: {
    subject: string;
    description: string;
  }): Promise<void> {
    await this.supportService.createTicket(payload);
  }

  /**
   * Product demo booking tool – delegates to CalendarModule.
   */
  async bookProductDemo(payload: {
    customerEmail: string;
    productId: string;
    preferredTime?: string;
  }): Promise<void> {
    await this.calendarService.bookProductDemo(payload);
  }
}

