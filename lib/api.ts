import { API_BASE_URL } from "./constants";
import { getIdToken, refreshSession, forceSignOut } from "./auth";
import type {
  Affiliate,
  AffiliateSoldPixelConfig,
  AffiliateStatus,
  ApiResponse,
  AuditQueryResponse,
  AvailablePlugin,
  Campaign,
  ClientDeliveryConfig,
  Destination,
  ResponseValidation,
  DistributionMode,
  CampaignParticipantStatus,
  CampaignStatus,
  Client,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginSettingRecord,
  PluginView,
  Lead,
  LogicCatalogSet,
  LogicCatalogVersion,
  SourceAffiliatePixelInfo,
  TagDefinitionRecord,
  PaginatedResponse,
  IntakeLogItem,
  TableColumnConfig,
  UserTablePreference,
} from "./types";

interface RequestInitWithBody extends RequestInit {
  body?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const text = await res.text();
  if (!text) return {} as T;

  const data = JSON.parse(text) as T;
  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success?: boolean }).success === false
  ) {
    const err = data as { message?: string; error?: string };
    throw new Error(err.error || err.message || "Request failed");
  }

  return data;
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
export async function createCampaign(payload: {
  name: string;
  tags?: string[];
}) {
  const url = `${API_BASE_URL}/campaigns`;
  return request<ApiResponse<Campaign>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCampaign(
  id: string,
  payload: { name: string; default_cherry_pickable?: boolean },
) {
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
  const url = `${API_BASE_URL}/campaigns/${id}/contracts`;
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
  const url = `${API_BASE_URL}/campaigns/${id}/contracts/${clientId}`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function removeClientFromCampaign(id: string, clientId: string) {
  const url = `${API_BASE_URL}/campaigns/${id}/contracts/${clientId}`;
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

export async function setCampaignAffiliateLeadCap(
  campaignId: string,
  affiliateId: string,
  leadCap: number | null,
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/affiliates/${affiliateId}/cap`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ lead_cap: leadCap }),
  });
}

export async function setCampaignTags(campaignId: string, tags: string[]) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/tags`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ tags }),
  });
}

export async function setCampaignAffiliateValidationBypass(
  campaignId: string,
  affiliateId: string,
  validationBypass: {
    trusted_form_claim?: boolean;
    duplicate_check?: boolean;
    ipqs_phone?: boolean;
    ipqs_email?: boolean;
    ipqs_ip?: boolean;
    all?: boolean;
  },
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/affiliates/${affiliateId}/validation-bypass`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ validation_bypass: validationBypass }),
  });
}

export async function setCampaignAffiliateSoldPixelConfig(
  campaignId: string,
  affiliateId: string,
  payload: AffiliateSoldPixelConfig,
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/affiliates/${affiliateId}/pixel`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setCampaignClientDeliveryConfig(
  campaignId: string,
  clientId: string,
  payload: ClientDeliveryConfig,
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/contracts/${clientId}/delivery`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Sets only the weighted-distribution share for a single linked client.
 *  The full delivery config must be supplied so all required fields are included. */
export async function setClientWeight(
  campaignId: string,
  clientId: string,
  deliveryConfig: ClientDeliveryConfig,
  weight: number,
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/contracts/${clientId}/delivery`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ ...deliveryConfig, weight }),
  });
}

export async function setCampaignDistributionConfig(
  campaignId: string,
  payload: {
    mode: DistributionMode;
    enabled: boolean;
  },
) {
  const url = `${API_BASE_URL}/campaigns/${campaignId}/distribution`;
  return request<ApiResponse<Campaign>>(url, {
    method: "PUT",
    body: JSON.stringify({ mode: payload.mode, enabled: payload.enabled }),
  });
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
export async function listLeads(params?: {
  campaign_id?: string;
  test?: boolean;
  includeDeleted?: boolean;
  include_trace?: boolean;
  limit?: number;
  lastEvaluatedKey?: string;
}) {
  const url = buildUrl("/leads", params);
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

// ── Tag Definitions (/tenant-config/tag-definitions) ──────────────────────

export async function listTagDefinitions(params?: {
  includeDeleted?: boolean;
}) {
  const url = buildUrl("/tenant-config/tag-definitions", params);
  return request<{
    success: boolean;
    data: { items: TagDefinitionRecord[]; count: number };
  }>(url);
}

export async function createTagDefinition(payload: {
  label: string;
  color?: string;
}) {
  const url = buildUrl("/tenant-config/tag-definitions");
  return request<ApiResponse<TagDefinitionRecord>>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTagDefinition(
  id: string,
  payload: {
    label?: string;
    color?: string;
  },
) {
  const url = buildUrl(
    `/tenant-config/tag-definitions/${encodeURIComponent(id)}`,
  );
  return request<ApiResponse<TagDefinitionRecord>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteTagDefinition(id: string, permanent = false) {
  const url = buildUrl(
    `/tenant-config/tag-definitions/${encodeURIComponent(id)}`,
    permanent ? { permanent: "true" } : undefined,
  );
  return request<{ success: boolean; message?: string }>(url, {
    method: "DELETE",
  });
}

export async function getLeadById(id: string) {
  const url = buildUrl(`/leads/${id}`);
  return request<ApiResponse<Lead>>(url);
}

export async function getLeadByIdWithTrace(id: string, includeTrace = true) {
  const url = buildUrl(`/leads/${id}`, {
    include_trace: includeTrace,
  });
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
  CasingMode,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaValueMapping,
  CriteriaFieldType,
  CriteriaCatalogSet,
  CriteriaCatalogVersion,
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
    casing?: CasingMode;
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
    casing?: CasingMode;
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
  stateMapping?: "abbr_to_name" | "name_to_abbr" | null,
) {
  const url = buildUrl(
    `/campaigns/${encodeURIComponent(campaignId)}/criteria/${encodeURIComponent(fieldId)}/mappings`,
  );
  return request<ApiResponse<CriteriaField>>(url, {
    method: "PUT",
    body: JSON.stringify({
      value_mappings: mappings,
      ...(stateMapping !== undefined ? { state_mapping: stateMapping } : {}),
    }),
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

// ─── Criteria Catalog ──────────────────────────────────────────────────────────────

export async function listCriteriaCatalog() {
  return request<{ success: boolean; data: { items: CriteriaCatalogSet[] } }>(
    buildUrl("/campaigns/criteria-catalog"),
  );
}

export async function getCriteriaCatalogSet(setId: string) {
  return request<{
    success: boolean;
    data: { set: CriteriaCatalogSet; versions: CriteriaCatalogVersion[] };
  }>(buildUrl(`/campaigns/criteria-catalog/${encodeURIComponent(setId)}`));
}

export async function getCriteriaCatalogVersion(
  setId: string,
  version: number,
) {
  return request<{ success: boolean; data: CriteriaCatalogVersion }>(
    buildUrl(
      `/campaigns/criteria-catalog/${encodeURIComponent(setId)}/versions/${version}`,
    ),
  );
}

type CatalogFieldInput = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required?: boolean;
  description?: string;
  options?: CriteriaFieldOption[];
  value_mappings?: CriteriaValueMapping[];
  state_mapping?: "abbr_to_name" | "name_to_abbr" | null;
  client_override?: boolean;
  affiliate_override?: boolean;
};

export async function createCriteriaCatalogSet(payload: {
  name: string;
  description?: string;
  tags?: Record<string, string>;
  fields?: CatalogFieldInput[];
}) {
  return request<{ success: boolean; data: { set: CriteriaCatalogSet } }>(
    buildUrl("/campaigns/criteria-catalog"),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateCriteriaCatalogSet(
  setId: string,
  payload: {
    name?: string;
    description?: string;
    fields: CatalogFieldInput[];
  },
) {
  return request<{ success: boolean; data: { set: CriteriaCatalogSet } }>(
    buildUrl(`/campaigns/criteria-catalog/${encodeURIComponent(setId)}`),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteCriteriaCatalogSet(setId: string) {
  return request<{ success: boolean }>(
    buildUrl(`/campaigns/criteria-catalog/${encodeURIComponent(setId)}`),
    { method: "DELETE" },
  );
}

export async function deleteCriteriaCatalogVersion(
  setId: string,
  version: number,
) {
  return request<{ success: boolean }>(
    buildUrl(
      `/campaigns/criteria-catalog/${encodeURIComponent(setId)}/versions/${version}`,
    ),
    { method: "DELETE" },
  );
}

export async function applyCriteriaCatalog(
  campaignId: string,
  criteria_set_id: string,
  version: number,
) {
  return request<{ success: boolean; data: unknown }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/criteria/apply-catalog`,
    ),
    { method: "POST", body: JSON.stringify({ criteria_set_id, version }) },
  );
}

export async function listLogicCatalog() {
  return request<{ success: boolean; data: { items: LogicCatalogSet[] } }>(
    buildUrl("/campaigns/logic-catalog"),
  );
}

export async function getLogicCatalogSet(setId: string) {
  return request<{
    success: boolean;
    data: { set: LogicCatalogSet; versions: LogicCatalogVersion[] };
  }>(buildUrl(`/campaigns/logic-catalog/${encodeURIComponent(setId)}`));
}

export async function getLogicCatalogVersion(setId: string, version: number) {
  return request<{ success: boolean; data: LogicCatalogVersion }>(
    buildUrl(
      `/campaigns/logic-catalog/${encodeURIComponent(setId)}/versions/${version}`,
    ),
  );
}

type LogicCatalogRuleInput = {
  name: string;
  enabled?: boolean;
  conditions: {
    field_name: string;
    operator: string;
    value?: string | string[];
  }[];
};

export async function createLogicCatalogSet(payload: {
  name: string;
  description?: string;
  tags?: Record<string, string>;
  rules?: LogicCatalogRuleInput[];
}) {
  return request<{ success: boolean; data: { set: LogicCatalogSet } }>(
    buildUrl("/campaigns/logic-catalog"),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateLogicCatalogSet(
  setId: string,
  payload: {
    name?: string;
    description?: string;
    rules: LogicCatalogRuleInput[];
  },
) {
  return request<{ success: boolean; data: { set: LogicCatalogSet } }>(
    buildUrl(`/campaigns/logic-catalog/${encodeURIComponent(setId)}`),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteLogicCatalogSet(setId: string) {
  return request<{ success: boolean }>(
    buildUrl(`/campaigns/logic-catalog/${encodeURIComponent(setId)}`),
    { method: "DELETE" },
  );
}

export async function deleteLogicCatalogVersion(
  setId: string,
  version: number,
) {
  return request<{ success: boolean }>(
    buildUrl(
      `/campaigns/logic-catalog/${encodeURIComponent(setId)}/versions/${version}`,
    ),
    { method: "DELETE" },
  );
}

export async function applyLogicCatalog(
  campaignId: string,
  logic_set_id: string,
  version: number,
) {
  return request<{ success: boolean; data: unknown }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/logic/apply-catalog`,
    ),
    { method: "POST", body: JSON.stringify({ logic_set_id, version }) },
  );
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
    enabled?: boolean;
    conditions: {
      field_name: string;
      operator: string;
      value?: string | string[];
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
    enabled?: boolean;
    conditions?: {
      field_name: string;
      operator: string;
      value?: string | string[];
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

// ─── Affiliate Logic Rule Overrides ──────────────────────────────────────────

type LogicRulePayload = {
  name: string;
  enabled?: boolean;
  conditions: {
    field_name: string;
    operator: string;
    value?: string | string[];
  }[];
};

type LogicRuleUpdatePayload = Partial<LogicRulePayload>;

export async function listAffiliateLogicRules(
  campaignId: string,
  affiliateId: string,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/logic-rules`,
    ),
  );
}

export async function createAffiliateLogicRule(
  campaignId: string,
  affiliateId: string,
  payload: LogicRulePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/logic-rules`,
    ),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateAffiliateLogicRule(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
  payload: LogicRuleUpdatePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/logic-rules/${encodeURIComponent(ruleId)}`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteAffiliateLogicRule(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
) {
  return request<{ success: boolean; data: { id: string } }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/logic-rules/${encodeURIComponent(ruleId)}`,
    ),
    { method: "DELETE" },
  );
}

// ── Per-Affiliate Pixel Criteria ──────────────────────────────────────────────

export async function listAffiliatePixelCriteria(
  campaignId: string,
  affiliateId: string,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/pixel-criteria`,
    ),
  );
}

export async function createAffiliatePixelCriterion(
  campaignId: string,
  affiliateId: string,
  payload: LogicRulePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/pixel-criteria`,
    ),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateAffiliatePixelCriterion(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
  payload: LogicRuleUpdatePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/pixel-criteria/${encodeURIComponent(ruleId)}`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteAffiliatePixelCriterion(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
) {
  return request<{ success: boolean; data: { id: string } }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/pixel-criteria/${encodeURIComponent(ruleId)}`,
    ),
    { method: "DELETE" },
  );
}

export async function applyLogicCatalogToAffiliate(
  campaignId: string,
  affiliateId: string,
  logic_set_id: string,
  version: number,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/logic/apply-catalog`,
    ),
    { method: "POST", body: JSON.stringify({ logic_set_id, version }) },
  );
}

// ── Per-Affiliate Sold Criteria ─────────────────────────────────────────────

export async function listAffiliateSoldCriteria(
  campaignId: string,
  affiliateId: string,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/sold-criteria`,
    ),
  );
}

export async function createAffiliateSoldCriterion(
  campaignId: string,
  affiliateId: string,
  payload: LogicRulePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/sold-criteria`,
    ),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateAffiliateSoldCriterion(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
  payload: LogicRuleUpdatePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/sold-criteria/${encodeURIComponent(ruleId)}`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteAffiliateSoldCriterion(
  campaignId: string,
  affiliateId: string,
  ruleId: string,
) {
  return request<{ success: boolean; data: { id: string } }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/sold-criteria/${encodeURIComponent(ruleId)}`,
    ),
    { method: "DELETE" },
  );
}

// ─── Affiliate Cherry-Pick Override ──────────────────────────────────────────

export async function updateAffiliateCherryPickOverride(
  campaignId: string,
  affiliateId: string,
  value: boolean | null,
) {
  return request<ApiResponse<Campaign>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/affiliates/${encodeURIComponent(affiliateId)}/cherry-pick-override`,
    ),
    { method: "PUT", body: JSON.stringify({ value }) },
  );
}

// ─── Client Logic Rule Overrides ─────────────────────────────────────────────

export async function listClientLogicRules(
  campaignId: string,
  clientId: string,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic-rules`,
    ),
  );
}

export async function createClientLogicRule(
  campaignId: string,
  clientId: string,
  payload: LogicRulePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic-rules`,
    ),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateClientLogicRule(
  campaignId: string,
  clientId: string,
  ruleId: string,
  payload: LogicRuleUpdatePayload,
) {
  return request<{ success: boolean; data: LogicRule }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic-rules/${encodeURIComponent(ruleId)}`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteClientLogicRule(
  campaignId: string,
  clientId: string,
  ruleId: string,
) {
  return request<{ success: boolean; data: { id: string } }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic-rules/${encodeURIComponent(ruleId)}`,
    ),
    { method: "DELETE" },
  );
}

export async function applyLogicCatalogToClient(
  campaignId: string,
  clientId: string,
  logic_set_id: string,
  version: number,
) {
  return request<{ success: boolean; data: LogicRule[] }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic/apply-catalog`,
    ),
    { method: "POST", body: JSON.stringify({ logic_set_id, version }) },
  );
}

export async function syncClientLogicToCampaign(
  campaignId: string,
  clientId: string,
) {
  return request<{
    success: boolean;
    data: { kept_rules: LogicRule[]; removed_count: number };
  }>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/logic/sync-to-campaign`,
    ),
    { method: "POST" },
  );
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

// ─── Table Preferences ───────────────────────────────────────────────────────

export async function getUserTablePreference(tableId: string) {
  return request<{ success: boolean; data: UserTablePreference }>(
    buildUrl(`/users/preferences/${encodeURIComponent(tableId)}`),
  );
}

export async function setUserTablePreference(
  tableId: string,
  payload: {
    columns: TableColumnConfig[];
    filters?: Array<{ field: string; value: unknown; operator?: string }>;
  },
) {
  return request<{ success: boolean; data: UserTablePreference }>(
    buildUrl(`/users/preferences/${encodeURIComponent(tableId)}`),
    { method: "PUT", body: JSON.stringify({ config: payload }) },
  );
}

export async function deleteUserTablePreference(tableId: string) {
  return request<{ success: boolean }>(
    buildUrl(`/users/preferences/${encodeURIComponent(tableId)}`),
    { method: "DELETE" },
  );
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

// ─── Cherry-Pick ──────────────────────────────────────────────────────────────

export async function listEligibleClients(leadId: string) {
  return request<{
    success: boolean;
    data: {
      clients: import("./types").EligibleClientEntry[];
      source_affiliate_pixel?: SourceAffiliatePixelInfo;
    };
  }>(
    buildUrl(
      `/cherry-pick/eligible-clients?lead_id=${encodeURIComponent(leadId)}`,
    ),
  );
}

export async function updateLeadPickability(
  leadId: string,
  cherry_pickable: boolean,
) {
  return request<{ success: boolean; data: { lead: import("./types").Lead } }>(
    buildUrl(`/cherry-pick/${encodeURIComponent(leadId)}/pickability`),
    { method: "PATCH", body: JSON.stringify({ cherry_pickable }) },
  );
}

export async function executeCherryPick(
  leadId: string,
  body: {
    target_client_id: string;
    campaign_id?: string;
    fire_affiliate_pixel?: boolean;
    skip_trusted_form_claim?: boolean;
    skip_duplicate_check?: boolean;
    skip_ipqs_phone?: boolean;
    skip_ipqs_email?: boolean;
    skip_ipqs_ip?: boolean;
    payload_overrides?: Record<string, unknown>;
    removed_payload_fields?: string[];
  },
) {
  return request<{
    success: boolean;
    data: import("./types").CherryPickMeta;
  }>(buildUrl(`/cherry-pick/${encodeURIComponent(leadId)}/execute`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Destinations ──────────────────────────────────────────────────────────────

export async function listDestinations(campaignId: string, clientId: string) {
  return request<ApiResponse<Destination[]>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/destinations`,
    ),
  );
}

export async function getDestination(
  campaignId: string,
  clientId: string,
  destId: string,
) {
  return request<ApiResponse<Destination>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/destinations/${encodeURIComponent(destId)}`,
    ),
  );
}

export async function addDestination(
  campaignId: string,
  clientId: string,
  payload: Partial<Destination>,
) {
  return request<ApiResponse<Destination>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/destinations`,
    ),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateDestination(
  campaignId: string,
  clientId: string,
  destId: string,
  payload: Partial<Destination>,
) {
  return request<ApiResponse<Destination>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/destinations/${encodeURIComponent(destId)}`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteDestination(
  campaignId: string,
  clientId: string,
  destId: string,
) {
  return request<ApiResponse<void>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/destinations/${encodeURIComponent(destId)}`,
    ),
    { method: "DELETE" },
  );
}

// ─── Response Validation ───────────────────────────────────────────────────────

export async function getResponseValidation(
  campaignId: string,
  clientId: string,
) {
  return request<ApiResponse<ResponseValidation | null>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/response-validation`,
    ),
  );
}

export async function saveResponseValidation(
  campaignId: string,
  clientId: string,
  payload: ResponseValidation,
) {
  return request<ApiResponse<ResponseValidation>>(
    buildUrl(
      `/campaigns/${encodeURIComponent(campaignId)}/contracts/${encodeURIComponent(clientId)}/response-validation`,
    ),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

// ─── Platform Presets ──────────────────────────────────────────────────────────

export async function listPlatformPresets() {
  return request<ApiResponse<unknown[]>>(
    buildUrl("/tenant-config/platform-presets"),
  );
}

export async function getPlatformPreset(id: string) {
  return request<ApiResponse<unknown>>(
    buildUrl(`/tenant-config/platform-presets/${encodeURIComponent(id)}`),
  );
}

export async function updatePlatformPreset(
  id: string,
  payload: Record<string, unknown>,
) {
  return request<ApiResponse<unknown>>(
    buildUrl(`/tenant-config/platform-presets/${encodeURIComponent(id)}`),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function createPlatformPreset(payload: Record<string, unknown>) {
  return request<ApiResponse<unknown>>(
    buildUrl("/tenant-config/platform-presets"),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

// ─── Tenant Presets ────────────────────────────────────────────────────────────

export async function listTenantPresets(tags?: Record<string, string>) {
  return request<ApiResponse<unknown[]>>(
    buildUrl("/tenant-config/presets", tags),
  );
}

export async function getTenantPreset(id: string) {
  return request<ApiResponse<unknown>>(
    buildUrl(`/tenant-config/presets/${encodeURIComponent(id)}`),
  );
}

export async function createTenantPreset(payload: Record<string, unknown>) {
  return request<ApiResponse<unknown>>(buildUrl("/tenant-config/presets"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTenantPreset(
  id: string,
  payload: Record<string, unknown>,
) {
  return request<ApiResponse<unknown>>(
    buildUrl(`/tenant-config/presets/${encodeURIComponent(id)}`),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function deleteTenantPreset(id: string) {
  return request<ApiResponse<void>>(
    buildUrl(`/tenant-config/presets/${encodeURIComponent(id)}`),
    { method: "DELETE" },
  );
}
