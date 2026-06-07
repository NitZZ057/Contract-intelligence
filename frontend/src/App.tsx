import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ContractCompare } from "@/pages/ContractCompare";
import { ContractDetail } from "@/pages/ContractDetail";
import { ContractQA } from "@/pages/ContractQA";
import { ContractUpload } from "@/pages/ContractUpload";
import { Dashboard } from "@/pages/Dashboard";
import { NotFound } from "@/pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="upload" element={<ContractUpload />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="compare" element={<ContractCompare />} />
        <Route path="qa" element={<ContractQA />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
