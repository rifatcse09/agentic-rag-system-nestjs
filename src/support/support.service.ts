import { Injectable } from '@nestjs/common';

interface SupportTicketPayload {
  subject: string;
  description: string;
}

@Injectable()
export class SupportService {
  /**
   * Placeholder support ticket creation.
   * Later this will call Jira / a DB / helpdesk API.
   */
  async createTicket(_payload: SupportTicketPayload): Promise<void> {
    // TODO: create support ticket
  }
}

