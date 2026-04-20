export type ClientStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type CampaignParticipantStatus = "TEST" | "LIVE" | "DISABLED";
export type CampaignStatus = "DRAFT" | "TEST" | "ACTIVE" | "INACTIVE";
export type DistributionMode = "round_robin" | "weighted";
export type CampaignDetailTab =
  | "overview"
  | "clients"
  | "affiliates"
  | "integrations"
  | "settings"
  | "history";

export type WebhookMethod = "POST" | "GET" | "PUT" | "PATCH";
export type PixelParameterMode = "query" | "body";

export interface WebhookFieldMapping {
  key: string;
  value_source: "field" | "static";
  parameter_target?: PixelParameterMode;
  field_name?: string;
  static_value?: unknown;
}

export interface WebhookAcceptanceRule {
  match_value: string;
  action: "passed" | "failed";
}

export interface ValidationCondition {
  destination_id: string;
  match_value: string;
  action: "passed" | "failed";
}

export interface ValidationGroup {
  conditions: ValidationCondition[];
}

export interface ResponseValidation {
  groups: ValidationGroup[];
}

export interface ClientDeliveryConfig {
  url: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  payload_mapping: WebhookFieldMapping[];
  acceptance_rules?: WebhookAcceptanceRule[];
}

export interface AffiliateSoldPixelConfig {
  enabled: boolean;
  url: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  payload_mapping: WebhookFieldMapping[];
  parameter_mode?: PixelParameterMode;
}

export interface CampaignValidationBypassConfig {
  trusted_form_claim?: boolean;
  duplicate_check?: boolean;
  ipqs_phone?: boolean;
  ipqs_email?: boolean;
  ipqs_ip?: boolean;
  all?: boolean;
}

export type ParticipantLogicMode = "pinned" | "inherit_campaign";

export interface CampaignClientOverride {
  criteria_set_id?: string;
  criteria_set_version?: number;
  logic_set_id?: string;
  logic_set_version?: number;
  logic_rules?: LogicRule[];
  logic_mode?: ParticipantLogicMode;
  validation_bypass?: CampaignValidationBypassConfig;
  metadata?: Record<string, unknown>;
}

export interface CampaignAffiliateOverride {
  criteria_set_id?: string;
  criteria_set_version?: number;
  logic_set_id?: string;
  logic_set_version?: number;
  logic_rules?: LogicRule[];
  logic_mode?: ParticipantLogicMode;
  validation_bypass?: CampaignValidationBypassConfig;
  metadata?: Record<string, unknown>;
}

export interface CampaignDistributionConfig {
  mode: DistributionMode;
  enabled: boolean;
  rr_last_client_id?: string | null;
}

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
  notes?: string;
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
  notes?: string;
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
  sold_pixel_config?: AffiliateSoldPixelConfig;
  /** Per-affiliate rules evaluated against lead payload before firing the sold pixel. */
  pixel_criteria?: LogicRule[];
  /** Per-affiliate rules that refine whether a lead counts as "sold" post-delivery. */
  sold_criteria?: LogicRule[];
  validation_bypass?: CampaignValidationBypassConfig;
  lead_cap?: number | null;
  leads_sent?: number;
  leads_remaining?: number | null;
  quota_completion_percent?: number | null;
  cherry_pick_override?: boolean;
  history?: ParticipantHistoryEntry[];
}

export interface CampaignClient {
  client_id: string;
  status?: CampaignParticipantStatus;
  added_at?: string;
  /** @deprecated Use `destinations` instead. Retained for backward compatibility. */
  delivery_config?: ClientDeliveryConfig;
  destinations?: Destination[];
  response_validation?: ResponseValidation;
  weight?: number;
  leads_delivered_count?: number;
  history?: ParticipantHistoryEntry[];
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  distribution?: CampaignDistributionConfig;
  plugins?: {
    duplicate_check?: {
      enabled?: boolean;
      criteria?: Array<"phone" | "email">;
    };
    trusted_form?: {
      enabled?: boolean;
      stage?: number;
      gate?: boolean;
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
  submit_url?: string;
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
  criteria_set_id?: string | null;
  criteria_set_version?: number | null;
  logic_set_id?: string | null;
  logic_set_version?: number | null;
  logic_version?: string | null;
  tags?: string[];
  client_overrides?: Record<string, CampaignClientOverride>;
  affiliate_overrides?: Record<string, CampaignAffiliateOverride>;
  default_cherry_pickable?: boolean;
  default_field_casing?: CasingMode;
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
  /** Value mappings applied at intake by campaign logic rules. */
  mapped_fields?: Array<{
    field: string;
    original_value: string;
    mapped_value: string;
    mapped_at: string;
  }>;
  /** Whether this lead was sold to a client. */
  sold?: boolean;
  /** True when campaign-level logic rules rejected the lead (client delivery may still occur). */
  affiliate_logic_failed?: boolean;
  /** True when the webhook accepted but sold_criteria rules failed, overriding sold to false. */
  sold_criteria_failed?: boolean;
  /** Outcome of the delivery attempt. */
  sold_status?: "sold" | "not_sold" | "not_delivered";
  /** The client this lead was sold to, if any. */
  sold_to_client_id?: string;
  /** Full delivery result from the webhook attempt. */
  delivery_result?: LeadDeliveryResult;
  /** Whether this lead is eligible to be cherry-picked by an operator. */
  cherry_pickable?: boolean;
  /** Whether this lead has already been cherry-picked. */
  cherry_picked?: boolean;
  /** Metadata recorded when a cherry-pick delivery is executed. */
  cherry_pick_meta?: CherryPickMeta;
  /** End-to-end intake/QA/routing decision trace. */
  decision_trace?: LeadDecisionTrace;
}

export interface LeadDecisionTrace {
  version: number;
  intake?: {
    original_source?: string;
    order_number?: number;
    order_number_normalized?: boolean;
    captured_at: string;
  };
  qa?: {
    duplicate_detected?: boolean;
    pipeline_halted?: boolean;
    halt_plugin?: string;
    halt_reason?: string;
    bypass_applied?: CampaignValidationBypassConfig;
    evaluated_at: string;
  };
  routing?: {
    distribution_enabled?: boolean;
    eligible_client_ids?: string[];
    selected_client_id?: string;
    forced_single_client?: boolean;
    evaluated_at: string;
  };
  final_decision?: {
    accepted: boolean;
    reason: string;
    decided_at: string;
  };
}

export interface CherryPickMeta {
  target_client_id: string;
  source_campaign_id: string;
  delivery_result: LeadDeliveryResult;
  executed_at: string;
  executed_by?: RequestActor;
}

export interface EligibleClientEntry {
  client_id: string;
  client_name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  delivery_url?: string;
}

export interface SourceAffiliatePixelInfo {
  affiliate_id: string;
  campaign_id: string;
  campaign_key: string;
  pixel_enabled: boolean;
  pixel_url?: string;
  pixel_method?: "POST" | "GET" | "PUT" | "PATCH";
}

export interface ResolvedWebhookPayloadEntry {
  key: string;
  parameter_target: "query" | "body";
  value_source: "field" | "static";
  field_name?: string;
  static_value?: string;
  value: unknown;
}

export interface LeadDeliveryPayloadSnapshot {
  configured_webhook_url: string;
  final_webhook_url: string;
  webhook_method: "POST" | "GET" | "PUT" | "PATCH";
  attempt: number;
  headers: Record<string, string>;
  query_params?: Record<string, unknown>;
  body_payload?: Record<string, unknown>;
  body_raw?: string;
  effective_mapped_payload: ResolvedWebhookPayloadEntry[];
}

export interface LeadDeliveryResult {
  client_id: string;
  delivered_at: string;
  attempts?: number;
  webhook_url: string;
  final_webhook_url?: string;
  webhook_method: string;
  sent_query_params?: Record<string, unknown>;
  sent_body_payload?: Record<string, unknown>;
  sent_payload_snapshot?: LeadDeliveryPayloadSnapshot;
  webhook_response_status?: number;
  webhook_response_body?: string;
  accepted: boolean;
  acceptance_match?: string;
  error?: string;
  distribution_mode: DistributionMode;
  client_weight_at_delivery: number;
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

export interface TagDefinitionRecord {
  id: string;
  label: string;
  color?: string;
  is_deleted?: boolean;
  active?: boolean;
  deleted_at?: string | null;
  deleted_by?: RequestActor | null;
  created_at?: string;
  updated_at?: string;
  created_by?: RequestActor | null;
  updated_by?: RequestActor | null;
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

export type CriteriaFieldType = "Text" | "Number" | "Boolean" | "Date" | "List";

/** @deprecated Retained for backward compatibility during migration. */
export type LegacyCriteriaFieldType = "US State" | "Yes/No";

export type CasingMode =
  | "default"
  | "title_case"
  | "capitalize_first"
  | "lowercase"
  | "uppercase";

export type DestinationType = "webhook" | "email" | "google_sheets";

export interface Destination {
  id: string;
  name: string;
  type: DestinationType;
  url: string;
  method: WebhookMethod;
  headers?: Record<string, string>;
  payload_mapping: WebhookFieldMapping[];
  acceptance_rules?: WebhookAcceptanceRule[];
  state_mapping_override?: Record<
    string,
    "abbr_to_name" | "name_to_abbr" | null
  >;
  is_primary: boolean;
  claim_trusted_form?: boolean;
  require_successful_claim?: boolean;
}

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
  casing?: CasingMode;
  system_field?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Criteria Catalog ─────────────────────────────────────────────────────────

export interface CriteriaCatalogSet {
  id: string;
  record_type: "catalog_set";
  name: string;
  description?: string | null;
  tags?: string[];
  latest_version: number;
  created_at: string;
  updated_at: string;
  created_by?: AuditActor;
  updated_by?: AuditActor;
}

export interface CriteriaCatalogVersion {
  id: string;
  record_type: "catalog_version";
  criteria_set_id: string;
  version: number;
  name: string;
  fields: Array<{
    id?: string;
    field_label: string;
    field_name: string;
    data_type: CriteriaFieldType;
    required: boolean;
    description?: string;
    options?: CriteriaFieldOption[];
    value_mappings?: CriteriaValueMapping[];
    state_mapping?: "abbr_to_name" | "name_to_abbr" | null;
    client_override?: boolean;
    affiliate_override?: boolean;
    casing?: CasingMode;
    system_field?: boolean;
  }>;
  campaigns_using: string[];
  created_at: string;
  created_by?: AuditActor;
}

export interface LogicCatalogSet {
  id: string;
  record_type: "logic_set";
  name: string;
  description?: string | null;
  tags?: string[];
  latest_version: number;
  created_at: string;
  updated_at: string;
  created_by?: AuditActor;
  updated_by?: AuditActor;
}

export interface LogicCatalogVersion {
  id: string;
  record_type: "logic_version";
  logic_set_id: string;
  version: number;
  name: string;
  rules: LogicRule[];
  campaigns_using: string[];
  created_at: string;
  created_by?: AuditActor;
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

export interface LogicRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: LogicRuleCondition[];
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

// ─── Table Preferences ───────────────────────────────────────────────────────

export interface TableColumnConfig {
  key: string;
  visible: boolean;
  order: number;
}

export interface UserTablePreference {
  user_id?: string;
  table_id: string;
  config?: {
    columns?: TableColumnConfig[];
    sort?: Array<{ field: string; direction: "asc" | "desc" }>;
    filters?: Array<{ field: string; value: unknown; operator?: string }>;
  };
  // Backward-compatible fallback for older payload shapes.
  columns?: TableColumnConfig[];
  created_at?: string;
  updated_at?: string;
}

// ─── Intake Log ───────────────────────────────────────────────────────────────

export interface IntakeLogItem {
  id: string;
  campaign_id?: string;
  campaign_key?: string;
  received_at: string;
  status: "accepted" | "rejected" | "test";
  is_test?: boolean;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  trusted_form_cert?: string;
  rejection_reason?: string;
  rejection_errors?: string[];
  raw_body?: Record<string, unknown>;
  raw_headers?: Record<string, unknown>;
  response_status_code?: number;
  response_body?: unknown;
}
