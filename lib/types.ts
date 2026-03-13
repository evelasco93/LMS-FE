export type ClientStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type CampaignParticipantStatus = "TEST" | "LIVE" | "DISABLED";
export type CampaignStatus = "DRAFT" | "TEST" | "ACTIVE" | "INACTIVE";
export type CampaignDetailTab =
  | "overview"
  | "clients"
  | "affiliates"
  | "integrations"
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
  changed_by?: RequestActor | null;
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
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
  deleted_by?: RequestActor | null;
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
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
  deleted_by?: RequestActor | null;
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
    trusted_form?: {
      enabled?: boolean;
      stage?: number;
      gate?: boolean;
      claim?: boolean;
    };
    ipqs?: {
      enabled?: boolean;
      stage?: number;
      gate?: boolean;
      phone?: {
        enabled?: boolean;
        criteria?: {
          valid?: { enabled?: boolean; required?: boolean };
          fraud_score?: {
            enabled?: boolean;
            operator?: "lte" | "gte" | "eq";
            value?: number;
          };
          country?: { enabled?: boolean; allowed?: string[] };
        };
      };
      email?: {
        enabled?: boolean;
        criteria?: {
          valid?: { enabled?: boolean; required?: boolean };
          fraud_score?: {
            enabled?: boolean;
            operator?: "lte" | "gte" | "eq";
            value?: number;
          };
        };
      };
      ip?: {
        enabled?: boolean;
        criteria?: {
          fraud_score?: {
            enabled?: boolean;
            operator?: "lte" | "gte" | "eq";
            value?: number;
          };
          country_code?: { enabled?: boolean; allowed?: string[] };
          proxy?: { enabled?: boolean; allowed?: boolean };
          vpn?: { enabled?: boolean; allowed?: boolean };
        };
      };
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
    changed_by?: RequestActor | null;
  }>;
  edit_history?: EditHistoryEntry[];
  ever_linked_participants?: boolean;
  has_received_leads?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
  deleted_by?: RequestActor | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  active?: boolean;
}

export interface TrustedFormResult {
  success: boolean;
  cert_id?: string;
  phone_match?: boolean;
  previously_retained?: boolean;
  expires_at?: string;
  outcome?: string;
  error?: string;
  phone?: string;
  vendor?: string;
}

export interface IpqsCheckResult {
  success?: boolean;
  error?: string;
  /** Per-criterion pass/fail results (e.g. { valid: true, fraud_score: false }) */
  criteria_results?: Record<string, boolean>;
  /** Raw IPQS API response containing all numeric/string fields */
  raw?: Record<string, unknown>;
}

export interface IpqsResult {
  success?: boolean;
  phone?: IpqsCheckResult;
  email?: IpqsCheckResult;
  ip?: IpqsCheckResult;
  error?: string;
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
  trusted_form_result?: TrustedFormResult | null;
  ipqs_result?: IpqsResult | null;
  pipeline_halted?: boolean;
  halt_stage?: number;
  halt_plugin?: string;
  halt_reason?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
  deleted_by?: RequestActor | null;
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

/** One entry from the AVAILABLE_PLUGINS registry — static metadata, no DB. */
export interface AvailablePlugin {
  provider: string;
  name: string;
  credential_type: CredentialType;
  description?: string;
}

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

/** Full credential record returned by the API (DynamoDB-backed). */
export interface CredentialRecord {
  id: string;
  provider: string;
  name: string;
  /** Was `type` — renamed to avoid collision with DynamoDB record-type discriminator. */
  credential_type: CredentialType;
  credentials: CredentialFields;
  enabled: boolean;
  is_deleted?: boolean;
  active?: boolean;
  deleted_at?: string | null;
  deleted_by?: RequestActor | null;
  created_at?: string;
  updated_at?: string;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
}

export type PluginSchemaFieldType = "text" | "password" | "select";

export interface PluginSchemaField {
  name: string;
  label: string;
  type: PluginSchemaFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

/** Credential schema record (IDs are CS-prefixed). Defines the fields a plugin integration requires. */
export interface CredentialSchemaRecord {
  id: string;
  provider: string;
  name: string;
  credential_type: CredentialType;
  fields: PluginSchemaField[];
  is_deleted?: boolean;
  active?: boolean;
  deleted_at?: string | null;
  deleted_by?: RequestActor | null;
  created_at?: string;
  updated_at?: string;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
}

/** @deprecated Use CredentialSchemaRecord */
export type PluginSchemaRecord = CredentialSchemaRecord;

/** Global plugin setting: exactly one record per canonical plugin in AVAILABLE_PLUGINS. */
export interface PluginSettingRecord {
  /** PG-prefixed ID — empty string "" for plugins not yet configured. */
  id: string;
  /** Canonical plugin identifier, e.g. "trusted_form" | "ipqs". */
  provider: string;
  /** FK to CredentialRecord — null when the plugin has not been configured yet. */
  credentials_id: string | null;
  enabled: boolean;
  is_deleted?: boolean;
  active?: boolean;
  deleted_at?: string | null;
  deleted_by?: RequestActor | null;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
  edit_history?: EditHistoryEntry[];
  created_at?: string;
  updated_at?: string;
}

/**
 * PluginView = PluginSettingRecord enriched with AvailablePlugin registry metadata.
 * Returned by GET /tenant-config/plugin-settings — always one entry per canonical plugin.
 */
export interface PluginView extends PluginSettingRecord {
  name: string;
  credential_type: CredentialType;
  description?: string;
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

export type CriteriaFieldType =
  | "Text"
  | "Number"
  | "Boolean"
  | "Date"
  | "List"
  | "US State";

export interface CriteriaValueMapping {
  from: string[];
  to: string;
}

export interface CriteriaFieldOption {
  label: string;
  value: string;
}

export interface CriteriaField {
  id: string;
  campaign_id: string;
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  order?: number;
  description?: string;
  options?: CriteriaFieldOption[];
  value_mappings?: CriteriaValueMapping[];
  state_mapping?: "abbr_to_name" | "name_to_abbr" | null;
  client_override?: boolean;
  affiliate_override?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Logic Rules ──────────────────────────────────────────────────────────────

export type LogicRuleOperator =
  | "is"
  | "is_not"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export interface LogicRuleCondition {
  id?: string;
  field_name: string;
  operator: LogicRuleOperator;
  value?: string | string[];
}

export interface LogicRuleGroup {
  id?: string;
  conditions: LogicRuleCondition[];
}

export interface LogicRule {
  id: string;
  name: string;
  action: "pass" | "fail";
  enabled: boolean;
  groups: LogicRuleGroup[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditActor {
  sub?: string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "soft_deleted"
  | "restored"
  | "status_changed"
  | "key_rotated"
  | "participant_linked"
  | "participant_updated"
  | "participant_removed"
  | "criteria_field_added"
  | "criteria_field_updated"
  | "criteria_field_deleted"
  | "logic_rule_added"
  | "logic_rule_updated"
  | "logic_rule_deleted"
  | "mappings_updated"
  | "plugins_updated"
  | "credential_disabled"
  | "credential_enabled"
  | "plugin_setting_disabled"
  | "plugin_setting_enabled"
  | "password_reset"
  | (string & {});

export interface AuditLogItem {
  log_id: string;
  entity_id: string;
  entity_type: string;
  action: AuditAction;
  changes: AuditChange[];
  actor?: AuditActor | null;
  changed_at: string;
  date?: string;
  actor_sub?: string;
}

export interface AuditQueryResponse {
  success: boolean;
  data: {
    items: AuditLogItem[];
    nextCursor?: string | null;
  };
}
