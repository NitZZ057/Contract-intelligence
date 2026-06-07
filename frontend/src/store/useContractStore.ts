import { create } from "zustand";

interface ContractStore {
  activeContractId: string | null;
  compareSourceId: string | null;
  compareTargetId: string | null;
  setActiveContractId: (contractId: string | null) => void;
  setCompareSourceId: (contractId: string | null) => void;
  setCompareTargetId: (contractId: string | null) => void;
}

export const useContractStore = create<ContractStore>((set) => ({
  activeContractId: null,
  compareSourceId: null,
  compareTargetId: null,
  setActiveContractId: (contractId) => set({ activeContractId: contractId }),
  setCompareSourceId: (contractId) => set({ compareSourceId: contractId }),
  setCompareTargetId: (contractId) => set({ compareTargetId: contractId }),
}));
