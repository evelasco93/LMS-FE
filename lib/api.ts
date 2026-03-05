import { API_BASE_URL } from "./constants";
import { getIdToken, refreshSession, forceSignOut } from "./auth";
import type {
  Affiliate,
  AffiliateStatus,
  ApiResponse,
  Campaign,
  CampaignParticipantStatus,
  CampaignStatus,
  Client,
  Credential,
  Lead,
  PaginatedResponse,
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
  params?: Record<string, string | number | undefined | null>,
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

// Credentials (tenant config)
// GET list
export async function listCredentials() {
  const url = buildUrl("/tenant-config/credentials");
  return request<{ success: boolean; data: Credential[] }>(url);
}

// PUT upsert (creates or updates by provider)
export async function upsertCredential(payload: Credential) {
  const url = `${API_BASE_URL}/tenant-config/credentials`;
  return request<ApiResponse<Credential>>(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// DELETE by provider
export async function deleteCredential(provider: string) {
  const url = `${API_BASE_URL}/tenant-config/credentials/${encodeURIComponent(provider)}`;
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
