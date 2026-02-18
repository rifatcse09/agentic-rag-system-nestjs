import { Injectable } from '@nestjs/common';

interface ProductDemoPayload {
  customerEmail: string;
  productId: string;
  preferredTime?: string;
}

@Injectable()
export class CalendarService {
  /**
   * Placeholder product demo booking.
   * Later this will talk to your calendar / booking system.
   */
  async bookProductDemo(_payload: ProductDemoPayload): Promise<void> {
    // TODO: integrate with calendar API
  }
}

