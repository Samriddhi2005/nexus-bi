export interface Quota {
  dailyLimit: number;
  used: number;
  resetAt: string | null;
}

export interface CurrentUser {
  uid: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  plan: "free" | "pro";
  quota: Quota;
}

export interface ThoughtStep {
  agent: string;
  thought: string;
  status?: string;
}

export interface ChatResponse {
  session_id: string;
  message_id: string;
  final_insights: string;
  sql_query: string | null;
  guardrail_message: string | null;
  thought_log: ThoughtStep[];
  chart_json: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql_query?: string | null;
  guardrail_message?: string | null;
  thought_log?: ThoughtStep[];
  chart_json?: string | null;
  columns?: string[];
  rows?: Record<string, unknown>[];
  createdAt?: string;
}

export interface SchemaResponse {
  schema_text: string;
}

export interface DatasetSummary {
  id: string;
  tableName: string;
  originalFilename: string;
  rowCount: number;
  columns: string[];
  uploadedAt: string | null;
}

export interface OverviewStats {
  totalUsers: number;
  queriesToday: number;
  queries7d: number;
  guardrailBlocksToday: number;
  errorsToday: number;
}

export interface AdminUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string;
  plan: string;
  quotaUsed: number;
  quotaLimit: number;
}

export interface AuditLogEntry {
  id: string;
  uid: string;
  sessionId: string | null;
  sqlQuery: string | null;
  guardrailVerdict: string | null;
  blocked: boolean;
  error: string | null;
  timestamp: string;
}
