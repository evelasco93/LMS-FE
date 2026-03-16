import { API_BASE_URL } from "./constants";
import { getIdToken, refreshSession, forceSignOut } from "./auth";
import type {
  Affiliate,
  AffiliateStatus,
  ApiResponse,
  AuditQueryResponse,
  AvailablePlugin,
  Campaign,
  CampaignParticipantStatus,
  CampaignStatus,
  Client,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginSettingRecord,
  PluginView,
  Lead,
  PaginatedResponse,
  IntakeLogItem,
} from "./types";

interface RequestInitWithBody extends RequestInit {
  body?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
) {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : `${globalThis.location?.origin ?? "http://localhost"}${API_BASE_URL}`;

  // Safely join base (which may already include a path like /dev/v2) with the relative path.
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${normalizedBase}/${normalizedPath}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestInitWithBody = {}) {
  const { body, headers, ...rest } = options;

  const doFetch = async (token: string) =>
    fetch(path, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body,
    });

  let token = await getIdToken();
  if (!token) throw new Error("Not authenticated.");

  let res = await doFetch(token);

  // On 401: try refresh once, then give up
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed?.idToken) {
      token = refreshed.idToken;
      res = await doFetch(token);
    }
    if (res.status === 401) {
      forceSignOut();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  return handleResponse<T>(res);
}

// Clients
export async function listClients(params?: {
  status?: string;
  includeDeleted?: boolean;
}) {
  const url = buildUrl("/clients", params);
  return request<PaginatedResponse<Client>>(url);
}

export async function createClient(payload: Partial<Client>) {
  const url = `${API_BASE_URL}/clients`;
  return request<ApiResponse<Client>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(id: string, payload: Partial<Client>) {
  const url = `${API_BASE_URL}/clients/${id}`;
  return request<ApiResponse<Client>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteClient(id: string, permanent?: boolean) {
  const url = permanent
    ? `${API_BASE_URL}/clients/${id}?permanent=true`
    : `${API_BASE_URL}/clients/${id}`;
  return request<{
    success: boolean;
    message?: string;
    data?: { id: string; permanent: boolean };
  }>(url, {
    method: "DELETE",
  });
}

// Affiliates
export async function listAffiliates(params?: {
  status?: AffiliateStatus;
  includeDeleted?: boolean;
}) {
  const url = buildUrl("/affiliates", params);
  return request<PaginatedResponse<Affiliate>>(url);
}

export async function createAffiliate(payload: Partial<Affiliate>) {
  const url = `${API_BASE_URL}/affiliates`;
  return request<ApiResponse<Affiliate>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAffiliate(id: string, payload: Partial<Affiliate>) {
  const url = `${API_BASE_URL}/affiliates/${id}`;
  return request<ApiResponse<Affiliate>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAffiliate(id: string, permanent?: boolean) {
  const url = permanent
    ? `${API_BASE_URL}/affiliates/${id}?permanent=true`
    : `${API_BASE_URL}/affiliates/${id}`;
  return request<{
    success: boolean;
    message?: string;
    data?: { id: string; permanent: boolean };
  }>(url, {
    method: "DELETE",
  });
}

export async function deleteCampaign(id: string, permanent?: boolean) {
  const url = permanent
    ? `${API_BASE_URL}/campaigns/${id}?permanent=true`
    : `${API_BASE_URL}/campaigns/${id}`;
  return request<{
    success: boolean;
    message?: string;
    data?: { id: string; permanent: boolean };
  }>(url, {
    method: "DELETE",
  });
}

// Campaigns
export async function createCampaign(payload: { name: string }) {
  const url = `${API_BASE_URL}/campaigns`;
  return request<ApiResponse<Campaign>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCampaign(id: string, payload: { name: string }) {
  const url = `${API_BASE_URL}/campaigns/${id}`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// The spec only exposes POST /campaigns; if a GET is supported in the backend we call it, otherwise consumers should supply data through cache/mutations.
export async function listCampaigns() {
  const url = buildUrl("/campaigns");
  return request<PaginatedResponse<Campaign>>(url);
}

export async function updateCampaignStatus(id: string, status: CampaignStatus) {
  const url = `${API_BASE_URL}/campaigns/${id}/status`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function updateCampaignPlugins(
  id: string,
  payload: {
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
      phone?: { enabled?: boolean; criteria?: Record<string, unknown> };
      email?: { enabled?: boolean; criteria?: Record<string, unknown> };
      ip?: { enabled?: boolean; criteria?: Record<string, unknown> };
    };
  },
) {
  const url = `${API_BASE_URL}/campaigns/${id}/plugins`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function linkClientToCampaign(id: string, client_id: string) {
  const url = `${API_BASE_URL}/campaigns/${id}/clients`;
  return request<ApiResponse<Campaign>>(url, {
    method: "POST",
    body: JSON.stringify({ client_id }),
  });
}

export async function updateCampaignClientStatus(
  id: string,
  clientId: string,
  status: CampaignParticipantStatus,
) {
  const url = `${API_BASE_URL}/campaigns/${id}/clients/${clientId}`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function removeClientFromCampaign(id: string, clientId: string) {
  const url = `${API_BASE_URL}/campaigns/${id}/clients/${clientId}`;
  return request<ApiResponse<Campaign>>(url, { method: "DELETE" });
}

export async function linkAffiliateToCampaign(
  id: string,
  affiliate_id: string,
) {
  const url = `${API_BASE_URL}/campaigns/${id}/affiliates`;
  return request<ApiResponse<{ campaign: Campaign; campaign_key: string }>>(
    url,
    {
      method: "POST",
      body: JSON.stringify({ affiliate_id }),
    },
  );
}

export async function updateCampaignAffiliateStatus(
  id: string,
  affiliateId: string,
  status: CampaignParticipantStatus,
) {
  const url = `${API_BASE_URL}/campaigns/${id}/affiliates/${affiliateId}`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function removeAffiliateFromCampaign(
  id: string,
  affiliateId: string,
) {
  const url = `${API_BASE_URL}/campaigns/${id}/affiliates/${affiliateId}`;
  return request<ApiResponse<Campaign>>(url, { method: "DELETE" });
}

export async function rotateAffiliateKey(
  campaignId: string,
  affiliateId: string,
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/affiliates/${affiliateId}/rotate-key`;
  return request<ApiResponse<{ campaign: Campaign; campaign_key: string }>>(
    url,
    { method: "POST" },
  );
}

// Leads
export async function listLeads() {
  const url = buildUrl("/leads");
  return request<PaginatedResponse<Lead>>(url);
}

// ── Credentials (tenant config) ─────────────────────────────────────────────

export async function listCredentials(params?: { provider?: string }) {
  const url = buildUrl("/tenant-config/credentials", params);
  return request<{
    success: boolean;
    data: { items: CredentialRecord[]; count: number };
  }>(url);
}

export async function createCredential(payload: {
  provider: string;
  name: string;
  credential_type: string;
  credentials: Record<string, string>;
}) {
  const url = buildUrl("/tenant-config/credentials");
  return request<ApiResponse<CredentialRecord>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCredential(
  id: string,
  payload: {
    name?: string;
    type?: string;
    credentials?: Record<string, string>;
  },
) {
  const url = buildUrl(`/tenant-config/credentials/${encodeURIComponent(id)}`);
  return request<ApiResponse<CredentialRecord>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCredential(id: string) {
  const url = buildUrl(`/tenant-config/credentials/${encodeURIComponent(id)}`);
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

export async function disableCredential(id: string) {
  const url = buildUrl(
    `/tenant-config/credentials/${encodeURIComponent(id)}/disable`,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "PUT",
  });
}

export async function enableCredential(id: string) {
  const url = buildUrl(
    `/tenant-config/credentials/${encodeURIComponent(id)}/enable`,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "PUT",
  });
}

// ── Credential Schemas (/tenant-config/credential-schemas) ──────────────────

export async function listCredentialSchemas() {
  const url = buildUrl("/tenant-config/credential-schemas");
  return request<{
    success: boolean;
    data: { items: CredentialSchemaRecord[]; count: number };
  }>(url);
}

export async function createCredentialSchema(payload: {
  provider: string;
  name: string;
  credential_type: string;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "password" | "select";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }>;
}) {
  const url = buildUrl("/tenant-config/credential-schemas");
  return request<ApiResponse<CredentialSchemaRecord>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCredentialSchema(
  id: string,
  payload: {
    name?: string;
    credential_type?: string;
    fields?: Array<{
      name: string;
      label: string;
      type: "text" | "password" | "select";
      required: boolean;
      placeholder?: string;
      options?: string[];
    }>;
  },
) {
  const url = buildUrl(
    `/tenant-config/credential-schemas/${encodeURIComponent(id)}`,
  );
  return request<ApiResponse<CredentialSchemaRecord>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCredentialSchema(id: string, permanent = false) {
  const url = buildUrl(
    `/tenant-config/credential-schemas/${encodeURIComponent(id)}`,
    permanent ? { permanent: "true" } : undefined,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

// ── Available Plugins registry (/tenant-config/plugins) ─────────────────────

export async function listAvailablePlugins() {
  const url = buildUrl("/tenant-config/plugins");
  return request<{ success: boolean; data: AvailablePlugin[] }>(url);
}

// ── Plugin Settings (/tenant-config/plugin-settings) ────────────────────────

/**
 * Returns exactly one PluginView per canonical plugin (always fixed-size list).
 * Each entry merges PluginSettingRecord state with AvailablePlugin registry metadata.
 * Unconfigured plugins have id="", credentials_id=null, enabled=false.
 */
export async function listPluginSettings() {
  const url = buildUrl("/tenant-config/plugin-settings");
  return request<{ success: boolean; data: PluginView[] }>(url);
}

/**
 * Upserts the global plugin setting for a canonical provider.
 * @param provider - e.g. "trusted_form" | "ipqs"
 */
export async function setPluginSetting(
  provider: string,
  payload: { credentials_id?: string | null; enabled?: boolean },
) {
  const url = buildUrl(
    `/tenant-config/plugin-settings/${encodeURIComponent(provider)}`,
  );
  return request<ApiResponse<PluginSettingRecord>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePluginSetting(provider: string, permanent = false) {
  const url = buildUrl(
    `/tenant-config/plugin-settings/${encodeURIComponent(provider)}`,
    permanent ? { permanent: "true" } : undefined,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

export async function getLeadById(id: string) {
  const url = `${API_BASE_URL}/leads/${id}`;
  return request<ApiResponse<Lead>>(url);
}

export async function updateLead(
  id: string,
  payload: { payload: Record<string, unknown> },
) {
  const url = `${API_BASE_URL}/leads/${id}`;
  return request<ApiResponse<Lead>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ── Users (admin only) ──────────────────────────────────────────────────────
import type { CognitoUser, UserRole } from "./types";

export async function listUsers() {
  const url = buildUrl("/users");
  return request<{ success: boolean; message?: string; data: CognitoUser[] }>(
    url,
  );
}

export async function createUser(payload: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}) {
  const url = `${API_BASE_URL}/users`;
  return request<ApiResponse<CognitoUser>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  id: string,
  payload: { role?: UserRole; firstName?: string; lastName?: string },
) {
  const url = `${API_BASE_URL}/users/${encodeURIComponent(id)}`;
  return request<ApiResponse<CognitoUser>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resetUserPassword(id: string, password: string) {
  const url = `${API_BASE_URL}/users/${encodeURIComponent(id)}/password`;
  return request<{ success: boolean; message?: string }>(url, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export async function deleteUser(id: string, permanent?: boolean) {
  const url = permanent
    ? `${API_BASE_URL}/users/${encodeURIComponent(id)}?permanent=true`
    : `${API_BASE_URL}/users/${encodeURIComponent(id)}`;
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

export async function enableUser(id: string) {
  const url = `${API_BASE_URL}/users/${encodeURIComponent(id)}/enable`;
  return request<{ success: boolean; message?: string; data?: unknown }>(url, {
    method: "PUT",
  });
}

// ─── Campaign Criteria ─────────────────────────────────────────────────────────
import type {
  CriteriaField,
  CriteriaFieldOption,
  CriteriaValueMapping,
  CriteriaFieldType,
  LogicRule,
} from "./types";

export async function listCriteria(campaignId: string) {
  const url = buildUrl(`/campaigns/${encodeURIComponent(campaignId)}/criteria`);
  return request<{
    success: boolean;
    data: CriteriaField[];
  }>(url);
}

export async function createCriteriaField(
  campaignId: string,
  payload: {
    field_label: string;
    field_name: string;
    data_type: CriteriaFieldType;
    required: boolean;
    description?: string;
    state_mapping?: "abbr_to_name" | "name_to_abbr";
    options?: CriteriaFieldOption[];
  },
) {
  const url = buildUrl(`/campaigns/${encodeURIComponent(campaignId)}/criteria`);
  return request<ApiResponse<CriteriaField>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCriteriaField(
  campaignId: string,
  fieldId: string,
  payload: {
    field_label?: string;
    field_name?: string;
    data_type?: CriteriaFieldType;
    required?: boolean;
    description?: string;
    state_mapping?: "abbr_to_name" | "name_to_abbr" | null;
    options?: CriteriaFieldOption[];
  },
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/${encodeURIComponent(fieldId)}`,
  );
  return request<ApiResponse<CriteriaField>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCriteriaField(campaignId: string, fieldId: string) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/${encodeURIComponent(fieldId)}`,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

export async function reorderCriteria(campaignId: string, fieldIds: string[]) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/reorder`,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "PUT",
    body: JSON.stringify({ field_ids: fieldIds }),
  });
}

export async function updateCriteriaValueMappings(
  campaignId: string,
  fieldId: string,
  mappings: CriteriaValueMapping[],
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/${encodeURIComponent(fieldId)}/mappings`,
  );
  return request<ApiResponse<CriteriaField>>(url, {
    method: "PUT",
    body: JSON.stringify({ value_mappings: mappings }),
  });
}

// ─── QA Tools ─────────────────────────────────────────────────────────────────
export async function seedBaseFields(campaignId: string) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/base-fields`,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "POST",
  });
}

export async function qaCheckTrustedForm(
  certId: string,
  credentialsId?: string | null,
) {
  const url = `${API_BASE_URL}/qa/trusted-form/validate`;
  return request<{ success: boolean; data?: Record<string, unknown> }>(url, {
    method: "POST",
    body: JSON.stringify(
      credentialsId
        ? { cert_id: certId, credentials_id: credentialsId }
        : { cert_id: certId },
    ),
  });
}

export async function qaCheckIpqs(
  payload: { phone?: string; email?: string; ip_address?: string },
  credentialsId?: string | null,
) {
  const url = `${API_BASE_URL}/qa/ipqs/check`;
  return request<{
    success: boolean;
    data?: {
      success: boolean;
      phone?: {
        success: boolean;
        raw?: Record<string, unknown>;
        error?: string;
      };
      email?: {
        success: boolean;
        raw?: Record<string, unknown>;
        error?: string;
      };
      ip?: { success: boolean; raw?: Record<string, unknown>; error?: string };
    };
  }>(url, {
    method: "POST",
    body: JSON.stringify(
      credentialsId ? { ...payload, credentials_id: credentialsId } : payload,
    ),
  });
}

// ─── Logic Rules ─────────────────────────────────────────────────────────────

export async function listLogicRules(campaignId: string) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/logic-rules`,
  );
  return request<{ result: boolean; data: LogicRule[] }>(url);
}

export async function createLogicRule(
  campaignId: string,
  payload: {
    name: string;
    action: "pass" | "fail";
    enabled?: boolean;
    groups: {
      conditions: {
        field_name: string;
        operator: string;
        value?: string | string[];
      }[];
    }[];
  },
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/logic-rules`,
  );
  return request<{ result: boolean; data: LogicRule }>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLogicRule(
  campaignId: string,
  ruleId: string,
  payload: {
    name?: string;
    action?: "pass" | "fail";
    enabled?: boolean;
    groups?: {
      conditions: {
        field_name: string;
        operator: string;
        value?: string | string[];
      }[];
    }[];
  },
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/logic-rules/${encodeURIComponent(ruleId)}`,
  );
  return request<{ result: boolean; data: LogicRule }>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLogicRule(campaignId: string, ruleId: string) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/logic-rules/${encodeURIComponent(ruleId)}`,
  );
  return request<{ result: boolean; data: LogicRule }>(url, {
    method: "DELETE",
  });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function getFullAuditLog(params?: {
  limit?: number;
  cursor?: string;
}) {
  const url = buildUrl("/audit", params);
  return request<AuditQueryResponse>(url);
}

export async function getEntityAudit(
  entityId: string,
  params?: { limit?: number; cursor?: string },
) {
  const url = buildUrl(`/audit/${encodeURIComponent(entityId)}`, params);
  return request<AuditQueryResponse>(url);
}

export async function getAuditActivity(params: {
  entity_type?: string;
  actor_sub?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}) {
  const url = buildUrl("/audit/activity", params);
  return request<AuditQueryResponse>(url);
}

// ─── Intake Logs ────────────────────────────────────────────────────────────

export async function getIntakeLogs(params?: {
  campaign_id?: string;
  status?: "accepted" | "rejected" | "test";
  from_date?: string;
  to_date?: string;
  limit?: number;
  lastEvaluatedKey?: string;
}) {
  const url = buildUrl("/leads/intake-logs", params);
  return request<{
    success: boolean;
    message?: string;
    count?: number;
    data: IntakeLogItem[];
    lastEvaluatedKey?: string;
  }>(url);
}

// Posting instructions
export async function fetchPostingInstructionsPayload(
  campaignId: string,
  affiliateId: string,
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/posting-instructions/generate`,
  );
  return request<{
    success: boolean;
    message?: string;
    data: {
      campaign: {
        id: string;
        name: string;
        status: string;
        submit_url?: string;
        submit_url_test?: string;
      };
      affiliate: {
        id: string;
        name: string;
        campaign_key: string;
        link_status: string;
      };
      criteria_fields: Array<{
        field_name: string;
        field_label: string;
        data_type: string;
        required: boolean;
        description?: string;
        options?: Array<{ label: string; value: string }>;
        state_mapping?: "abbr_to_name" | "name_to_abbr";
        order?: number;
      }>;
      generated_at: string;
    };
  }>(url, {
    method: "POST",
    body: JSON.stringify({ affiliate_id: affiliateId }),
  });
}
