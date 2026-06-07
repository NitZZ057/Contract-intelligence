import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatMessage } from "@/types/chat";

interface ChatStore {
  messagesByContractId: Record<string, ChatMessage[]>;
  addMessage: (message: ChatMessage) => void;
  clearMessages: (contractId: string) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messagesByContractId: {},
      addMessage: (message) =>
        set((state) => ({
          messagesByContractId: {
            ...state.messagesByContractId,
            [message.contractId]: [...(state.messagesByContractId[message.contractId] ?? []), message],
          },
        })),
      clearMessages: (contractId) =>
        set((state) => ({
          messagesByContractId: {
            ...state.messagesByContractId,
            [contractId]: [],
          },
        })),
    }),
    {
      name: "contract-intelligence-chat",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
