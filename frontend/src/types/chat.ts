import type { QAResponse } from "@/types/contracts";

export interface ChatMessage {
  id: string;
  contractId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources: string[];
  confidence: number | null;
}

export interface PendingAnswer {
  contractId: string;
  question: string;
  response: QAResponse;
}
