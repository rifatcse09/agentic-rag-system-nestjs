import { Injectable } from '@nestjs/common';

interface InventoryQuery {
  query: string;
}

@Injectable()
export class InventoryService {
  /**
   * Placeholder inventory lookup.
   * Later this will query your real inventory DB or API.
   */
  async findStock(_input: InventoryQuery): Promise<void> {
    // TODO: implement inventory search
  }
}

