const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_BASE}/chat/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Upload failed');
  }

  return res.json();
}

export async function askQuestion(question: string): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/chat/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Query failed');
  }

  return res.json();
}

export async function agentChat(
  message: string,
  sessionId?: string,
): Promise<AgentChatResponse> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Agent chat failed');
  }

  return res.json();
}

export interface UploadResponse {
  success: boolean;
  message: string;
  chunksAdded: number;
  documentsProcessed?: number;
  pdfsProcessed?: number;
  uploadedFiles?: string[];
}

export interface AskResponse {
  success: boolean;
  answer: string;
  sources: string[];
  contextCount?: number;
  message?: string;
}

export interface AgentChatResponse {
  message: string;
  sources?: Array<{ id: string; title: string }>;
  toolCalls?: Array<{ tool: string; success: boolean }>;
}
