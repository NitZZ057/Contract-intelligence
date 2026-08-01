export type ContractStatus = "pending" | "processing" | "processed" | "failed";

export interface Contract {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  status: ContractStatus;
  extracted_text: string | null;
  page_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractUploadResponse {
  id: string;
  filename: string;
  original_filename: string;
  status: ContractStatus;
  created_at: string;
}

export interface ContractListResponse {
  items: Contract[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginationParams {
  skip: number;
  limit: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface CompareRequest {
  source_contract_id: string;
  target_contract_id: string;
}

export interface ModifiedClause {
  clause_type: string;
  original: string;
  updated: string;
  risk_level: RiskLevel;
  explanation: string;
}

export interface CompareResponse {
  added_clauses: string[];
  removed_clauses: string[];
  modified_clauses: ModifiedClause[];
  risk_summary: string;
  overall_risk_level: RiskLevel;
}

export interface BackendChange {
  change_type: "added" | "removed" | "modified";
  source_text: string | null;
  target_text: string | null;
  similarity: number;
}

export interface BackendCompareResponse {
  source_contract_id: string;
  target_contract_id: string;
  source_original_filename: string;
  target_original_filename: string;
  total_changes: number;
  added_count: number;
  removed_count: number;
  modified_count: number;
  changes: BackendChange[];
}

export interface QARequest {
  question: string;
}

export interface QAResponse {
  answer: string;
  source_chunks: string[];
  confidence: number;
}

export interface ApiError {
  message: string;
  code: string;
  status?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface ContractParties{
  service_provider: string | null;
  client: string | null;
  other_parties: string[];
}

export interface KeyDates{
  effective_date: string | null;
  expiry_date: string | null;
  renewal_date: string | null;
  termination_notice_deadline: string | null;
}

export interface ContractSummaryResponse{
  contract_id: string;
  filename: string;
  executive_summary: string;
  contract_type: string | null
  governing_law: string | null;
  parties: ContractParties;
  key_dates: KeyDates;
  payment_terms: string | null;
  termination_conditions: string | null;
  key_obligations: string[];
  risk_flags: string[];
  confidence: number;
  model_used: string;
  generated_at: string;
  contract_page_count: number | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
}
