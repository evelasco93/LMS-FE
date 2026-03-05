export type ClientStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type CampaignParticipantStatus = "TEST" | "LIVE" | "DISABLED";
export type CampaignStatus = "DRAFT" | "TEST" | "ACTIVE" | "INACTIVE";
export type CampaignDetailTab =
  | "overview"
  | "clients"
  | "affiliates"
  | "settings";

/** Identity of the user who performed an action (matches RequestActor schema). */
export interface RequestActor {
  sub?: string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

/** One entry in the `edit_history` array on Client, Affiliate, or Lead. */
export interface EditHistoryEntry {
  /** Field name (e.g. "name", "email") or dot-path for leads (e.g. "payload.email") */
  field: string;
  previous_value?: unknown;
  new_value?: unknown;
  changed_at: string;
  changed_by?: RequestActor | null;
}

/** A single audit entry in a participant's `history` array. */
export interface ParticipantHistoryEntry {
  event: "linked" | "status_changed" | "key_rotated";
  field?: string;
  from?: string | null;
  to: string;
  changed_at: string;
  changed_by?: { username?: string; email?: string } | null;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  client_code?: string;
  status: ClientStatus;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  active?: boolean;
  edit_history?: EditHistoryEntry[];
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  affiliate_code?: string;
  status: AffiliateStatus;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  active?: boolean;
  edit_history?: EditHistoryEntry[];
}

export interface CampaignAffiliate {
  affiliate_id: string;
  campaign_key: string;
  status?: CampaignParticipantStatus;
  added_at?: string;
  history?: ParticipantHistoryEntry[];
}

export interface CampaignClient {
  client_id: string;
  status?: CampaignParticipantStatus;
  added_at?: string;
  history?: ParticipantHistoryEntry[];
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  plugins?: {
    duplicate_check?: {
      enabled?: boolean;
      criteria?: Array<"phone" | "email">;
    };
  };
  clients?: CampaignClient[];
  affiliates?: CampaignAffiliate[];
  removed_clients?: Array<{
    client_id: string;
    added_at?: string;
    status_at_removal?: CampaignParticipantStatus;
    removed_at?: string;
    removed_by?: string;
  }>;
  removed_affiliates?: Array<{
    affiliate_id: string;
    campaign_key?: string;
    added_at?: string;
    status_at_removal?: CampaignParticipantStatus;
    removed_at?: string;
    removed_by?: string;
  }>;
  status_history?: Array<{
    from: CampaignStatus;
    to: CampaignStatus;
    changed_at: string;
    changed_by?: string;
  }>;
  edit_history?: EditHistoryEntry[];
  ever_linked_participants?: boolean;
  has_received_leads?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  active?: boolean;
}

export interface Lead {
  id: string;
  campaign_id: string;
  campaign_key: string;
  test: boolean;
  payload: Record<string, unknown>;
  duplicate?: boolean;
  duplicate_matches?: {
    lead_ids?: string[];
  };
  affiliate_status_at_intake?: string;
  rejected?: boolean;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  active?: boolean;
  /** Ordered log of all payload field changes. Field uses dot-notation: "payload.email" etc. */
  edit_history?: EditHistoryEntry[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  message?: string;
  data: {
    items: T[];
    count: number;
    lastEvaluatedKey?: string | null;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type CredentialType = "api_key" | "basic_auth" | "bearer_token";

export interface CredentialFields {
  apiKey?: string; // api_key
  username?: string; // basic_auth
  password?: string; // basic_auth
  token?: string; // bearer_token
  [key: string]: string | undefined;
}

export interface Credential {
  provider: string;
  type: CredentialType;
  credentials: CredentialFields;
  updated_at?: string;
}

export type UserRole = "admin" | "staff";

export interface CognitoUser {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  enabled?: boolean;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}
