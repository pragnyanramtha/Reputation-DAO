export type VeraRole = "user" | "assistant" | "system";

export interface VeraMessage {
  role: VeraRole;
  content: string;
}

export interface ChatRequestBody {
  messages: VeraMessage[];
  /** Optional high-level hint about what the user is doing */
  mode?: "explain" | "docs_qa" | "guidance" | "troubleshoot" | "support";
  /** Optional hint about which part of the app the user is in */
  page?: string;
}

export interface ChatResponseBody {
  answer: string;
  sources?: string[];
  ticketId?: string;
  suggestions?: string[];
}

export interface DocChunk {
  id: string;
  path: string;
  title: string;
  content: string;
}
