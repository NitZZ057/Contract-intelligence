import { Bot, FileQuestion, Loader2, Send, Trash2, User } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAskQuestion, useContracts } from "@/hooks/useContracts";
import { useChatStore } from "@/store/useChatStore";
import { useContractStore } from "@/store/useContractStore";
import type { ChatMessage } from "@/types/chat";
import { cn } from "@/utils/cn";

const suggestedQuestions = [
  "What are the payment terms?",
  "What is the termination clause?",
  "Are there any penalty clauses?",
];

function createMessage(
  contractId: string,
  role: ChatMessage["role"],
  content: string,
  sources: string[] = [],
  confidence: number | null = null,
): ChatMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    contractId,
    role,
    content,
    createdAt: new Date().toISOString(),
    sources,
    confidence,
  };
}

export function ContractQA() {
  const [searchParams] = useSearchParams();
  const contractsQuery = useContracts({ skip: 0, limit: 100 });
  const askMutation = useAskQuestion();
  const { activeContractId, setActiveContractId } = useContractStore();
  const { messagesByContractId, addMessage, clearMessages } = useChatStore();
  const [question, setQuestion] = useState("");

  const processedContracts = useMemo(
    () => (contractsQuery.data?.items ?? []).filter((contract) => contract.status === "processed"),
    [contractsQuery.data?.items],
  );
  const messages = activeContractId ? messagesByContractId[activeContractId] ?? [] : [];

  useEffect(() => {
    const contractFromUrl = searchParams.get("contract");
    if (contractFromUrl) {
      setActiveContractId(contractFromUrl);
    }
  }, [searchParams, setActiveContractId]);

  const submitQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!activeContractId || !trimmed) {
      return;
    }

    addMessage(createMessage(activeContractId, "user", trimmed));
    setQuestion("");
    const response = await askMutation.mutateAsync({ contractId: activeContractId, question: trimmed });
    addMessage(createMessage(activeContractId, "assistant", response.answer, response.source_chunks, response.confidence));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(question);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Contract Q&A</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Ask questions against processed contracts</h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {contractsQuery.isLoading ? (
          <LoadingSpinner label="Loading processed contracts" />
        ) : contractsQuery.isError ? (
          <ErrorMessage error={contractsQuery.error} title="Unable to load contracts" />
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="block flex-1">
              <span className="text-sm font-semibold text-slate-700">Contract</span>
              <select
                value={activeContractId ?? ""}
                onChange={(event) => setActiveContractId(event.target.value || null)}
                className="focus-ring mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
              >
                <option value="">Select a processed contract</option>
                {processedContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.original_filename}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => activeContractId && clearMessages(activeContractId)}
              disabled={!activeContractId || messages.length === 0}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear chat
            </button>
          </div>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-[480px] space-y-5 p-5">
          {!activeContractId ? (
            <div className="flex h-80 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileQuestion className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Select a contract to begin</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">Processed contracts can be queried with natural language questions.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Bot className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Start with a focused contract question</h3>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submitQuestion(suggestion)}
                    className="focus-ring rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" ? (
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </div>
                ) : null}
                <div className={cn("max-w-3xl rounded-lg px-4 py-3", message.role === "user" ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-800")}>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.role === "assistant" && message.confidence !== null ? (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-500">
                        <span>Confidence</span>
                        <span>{Math.round(message.confidence * 100)}%</span>
                      </div>
                      <progress className="mt-1 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-500" value={message.confidence} max={1} />
                    </div>
                  ) : null}
                  {message.sources.length > 0 ? (
                    <details className="mt-4 rounded-md border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">Sources</summary>
                      <ul className="mt-3 space-y-2">
                        {message.sources.map((source, index) => (
                          <li key={`${message.id}-source-${index}`} className="text-sm leading-6 text-slate-600">
                            {source}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                ) : null}
              </div>
            ))
          )}

          {askMutation.isPending ? (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="max-w-3xl rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-blue-500" aria-hidden="true" />
                {askMutation.streamedText || "Thinking through the contract..."}
              </div>
            </div>
          ) : null}
        </div>

        {askMutation.isError ? (
          <div className="border-t border-slate-200 p-4">
            <ErrorMessage error={askMutation.error} title="Question could not be answered" />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex gap-3 border-t border-slate-200 p-4">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={!activeContractId || askMutation.isPending}
            placeholder="Ask about obligations, penalties, dates, payment terms..."
            className="focus-ring min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
            aria-label="Contract question"
          />
          <button
            type="submit"
            disabled={!activeContractId || !question.trim() || askMutation.isPending}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
