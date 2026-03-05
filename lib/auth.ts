import { API_BASE_URL } from "./constants";

export interface AuthUser {
  email: string;
  firstName?: string;
  lastName?: string;
  role: "admin" | "staff";
}

export interface AuthSession {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

const SESSION_KEY = "lms.session";

const isBrowser = () => typeof window !== "undefined";

// JWT decode (payload only, no signature verification)
const decodeJwtPayload = (token: string): Record<string, unknown> => {
  try {
    const [, payload] = token.split(".");
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const extractUser = (idToken: string): AuthUser => {
  const p = decodeJwtPayload(idToken);
  const email = (p["email"] as string) || "";

  // Cognito standard OIDC claims: given_name / family_name.
  // Some user pools also emit a combined `name` claim.
  let firstName = (p["given_name"] ?? p["firstName"]) as string | undefined;
  let lastName = (p["family_name"] ?? p["lastName"]) as string | undefined;

  // Fall back to splitting the `name` full-name claim if individual parts are absent
  if (!firstName && !lastName) {
    const fullName = (p["name"] as string | undefined)?.trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    }
  }

  const groups = Array.isArray(p["cognito:groups"])
    ? (p["cognito:groups"] as string[])
    : [];
  return {
    email,
    firstName: firstName?.trim() || undefined,
    lastName: lastName?.trim() || undefined,
    role: groups.includes("admin") ? "admin" : "staff",
  };
};

export const saveSession = (session: AuthSession): void => {
  if (!isBrowser()) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = (): void => {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
};

export const readSession = (): AuthSession | null => {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    clearSession();
    return null;
  }
};

export const isSessionValid = (session: AuthSession | null): boolean => {
  if (!session?.idToken) return false;
  return session.expiresAt > Date.now() + 30_000;
};

export interface LoginResult {
  session: AuthSession;
  user: AuthUser;
}

export const login = async (
  email: string,
  password: string,
): Promise<LoginResult> => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const body = await res.json();

  if (!res.ok || !body?.success) {
    throw new Error(body?.message || body?.error || "Invalid credentials.");
  }

  const data = body.data as {
    id_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data?.id_token) throw new Error("Login response missing id_token.");

  const user = extractUser(data.id_token);
  const session: AuthSession = {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    user,
  };

  saveSession(session);
  return { session, user };
};

export const refreshSession = async (): Promise<AuthSession | null> => {
  const current = readSession();
  if (!current?.refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
      cache: "no-store",
    });

    const body = await res.json();
    if (!res.ok || !body?.success) return null;

    const data = body.data as { id_token: string; expires_in: number };
    if (!data?.id_token) return null;

    const session: AuthSession = {
      idToken: data.id_token,
      refreshToken: current.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      user: extractUser(data.id_token),
    };

    saveSession(session);
    return session;
  } catch {
    return null;
  }
};

export const getIdToken = async (): Promise<string | null> => {
  const session = readSession();
  if (!session) return null;
  if (isSessionValid(session)) return session.idToken;
  const refreshed = await refreshSession();
  if (refreshed && isSessionValid(refreshed)) return refreshed.idToken;
  forceSignOut();
  return null;
};

export const getIdTokenSync = (): string | null => {
  const session = readSession();
  if (!session || !isSessionValid(session)) return null;
  return session.idToken;
};

export const getCurrentUser = (): AuthUser | null => {
  const session = readSession();
  if (!session || !isSessionValid(session)) return null;
  return session.user;
};

export const signOut = (): void => {
  clearSession();
};

/**
 * Clears the local session AND dispatches `lms:session-invalidated` so the
 * Dashboard component can react immediately (e.g. when Cognito disables the
 * current user and their refresh token fails).
 */
export const forceSignOut = (): void => {
  clearSession();
  if (isBrowser()) {
    window.dispatchEvent(new Event("lms:session-invalidated"));
  }
};
