export type ClientStatus = "ACTIVE" | "INACTIVE";
export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type CampaignParticipantStatus = "TEST" | "LIVE" | "DISABLED";
export type CampaignStatus = "DRAFT" | "TEST" | "ACTIVE" | "INACTIVE";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  client_code?: string;
  status: ClientStatus;
  created_at?: string;
  updated_at?: string;
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
}

export interface CampaignAffiliate {
  affiliate_id: string;
  campaign_key: string;
  status?: CampaignParticipantStatus;
  added_at?: string;
}

export interface CampaignClient {
  client_id: string;
  status?: CampaignParticipantStatus;
  added_at?: string;
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
  status_history?: Array<{
    from: CampaignStatus;
    to: CampaignStatus;
    changed_at: string;
  }>;
  created_at?: string;
  updated_at?: string;
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
