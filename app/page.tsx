"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  HandHeart,
  KeyRound,
  LayoutGrid,
  Link2,
  LogOut,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import PhoneInput from "react-phone-input-2";

import { Sidebar, type NavKey } from "@/components/sidebar";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Table } from "@/components/table";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { SignInScreen } from "@/components/sign-in-screen";

import {
  createAffiliate,
  createCampaign,
  createClient,
  createUser,
  deleteAffiliate,
  deleteClient,
  deleteUser,
  listLeads,
  listCredentials,
  listUsers,
  upsertCredential,
  deleteCredential,
  linkAffiliateToCampaign,
  linkClientToCampaign,
  listAffiliates,
  listCampaigns,
  listClients,
  removeAffiliateFromCampaign,
  removeClientFromCampaign,
  resetUserPassword,
  updateAffiliate,
  updateCampaignPlugins,
  updateCampaignStatus,
  updateCampaignAffiliateStatus,
  updateCampaignClientStatus,
  updateClient,
  updateUser,
} from "@/lib/api";
import type {
  Affiliate,
  Campaign,
  Client,
  CognitoUser,
  Lead,
  Credential,
} from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatPhone,
  generateCodeFromName,
  statusColorMap,
} from "@/lib/utils";
import {
  login,
  getCurrentUser,
  getIdTokenSync,
  readSession,
  signOut,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import type {
  AffiliateStatus,
  CampaignParticipantStatus,
  ClientStatus,
} from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]";

/** Generates a random 12-char password meeting common complexity rules. */
const generatePassword = (): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  return [...base, ...rest].sort(() => Math.random() - 0.5).join("");
};

/** "Jane Doe" → "JD"; "Jane" → "JA"; no names → first two chars of email username */
const userInitials = (u: AuthUser): string => {
  if (u.firstName && u.lastName) {
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  }
  if (u.firstName) {
    return u.firstName.slice(0, 2).toUpperCase();
  }
  // Fall back to email username (before @)
  const prefix = u.email.split("@")[0] ?? u.email;
  return prefix.slice(0, 2).toUpperCase();
};

/** "Jane Doe" or "Jane" or "jane" (email prefix) */
const userDisplayName = (u: AuthUser): string => {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  if (name) return name;
  // Use the email username portion as a readable fallback
  return u.email.split("@")[0] ?? u.email;
};

const formatLocalDateTimeWithZone = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
};

const formatUtcDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
};

const formatCompactDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const month = byType.get("month") || "--";
  const day = byType.get("day") || "--";
  const year = byType.get("year") || "----";
  const hour = byType.get("hour") || "--";
  const minute = byType.get("minute") || "--";
  return `${month}/${day}/${year} ${hour}:${minute}`;
};

type CampaignDetailTab = "overview" | "clients" | "affiliates" | "settings";

export default function Dashboard() {
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthenticated"
  >("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // Drive the browser tab title from auth state.
  // DashboardContent overrides this once authenticated and a view is active.
  useEffect(() => {
    if (authStatus !== "authenticated") {
      document.title = "LMS | Sign In";
    }
  }, [authStatus]);

  useEffect(() => {
    const token = getIdTokenSync();
    const user = getCurrentUser();
    if (token && user) {
      setCurrentUser(user);
      setAuthStatus("authenticated");
      const sess = readSession();
      if (sess?.expiresAt) setExpiresAt(sess.expiresAt);
    } else {
      setAuthStatus("unauthenticated");
    }
  }, []);

  // Auto-logout when token expires
  useEffect(() => {
    if (authStatus !== "authenticated" || !expiresAt) return;
    const ms = expiresAt - Date.now();
    if (ms <= 0) {
      handleSignOut();
      return;
    }
    const timer = setTimeout(() => {
      toast.error("Session expired. Please sign in again.");
      handleSignOut();
    }, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, expiresAt]);

  const handleSignIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { session, user } = await login(email, password);
      setCurrentUser(user);
      setExpiresAt(session.expiresAt);
      // Wait for the flag-raise animation (1.2s) + colour transition buffer
      // before switching screens so it always plays to completion
      await new Promise((resolve) => setTimeout(resolve, 1400));
      setAuthStatus("authenticated");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-in failed.");
      throw error;
    }
  };

  const handleSignOut = () => {
    // Clear any URL params so they don't restore after the next login
    window.history.replaceState(null, "", window.location.pathname);
    setCurrentUser(null);
    setExpiresAt(null);
    setAuthStatus("unauthenticated"); // triggers useEffect above → "LMS | Sign In"
    signOut();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {authStatus === "checking" && (
        <motion.main
          key="checking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-screen items-center justify-center bg-[--color-bg] text-[--color-text]"
        >
          <p className="text-sm text-[--color-text-muted]">Checking session…</p>
        </motion.main>
      )}
      {authStatus !== "authenticated" && authStatus !== "checking" && (
        <SignInScreen key="signin" onSignIn={handleSignIn} error={authError} />
      )}
      {authStatus === "authenticated" && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <DashboardContent
            onSignOut={handleSignOut}
            currentUser={currentUser}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DashboardContent({
  onSignOut,
  currentUser,
}: {
  onSignOut: () => void;
  currentUser: AuthUser | null;
}) {
  const [active, setActive] = useState<NavKey>("home");

  // Sync browser tab title to active view
  useEffect(() => {
    const labels: Record<NavKey, string> = {
      home: "Home",
      leads: "Leads",
      clients: "Clients",
      affiliates: "Affiliates",
      campaigns: "Campaigns",
      settings: "Settings",
    };
    document.title = `LMS | ${labels[active] ?? active}`;
  }, [active]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [campaignDetailTab, setCampaignDetailTab] =
    useState<CampaignDetailTab>("overview");
  const [focusedAffiliateId, setFocusedAffiliateId] = useState<string | null>(
    null,
  );

  const [clientModal, setClientModal] = useState(false);
  const [affiliateModal, setAffiliateModal] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [credentialModal, setCredentialModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(
    null,
  );
  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false);

  // Settings sub-tabs & user management
  const [settingsTab, setSettingsTab] = useState<"credentials" | "users">(
    "credentials",
  );
  const [userSearch, setUserSearch] = useState("");
  const [userCreateModal, setUserCreateModal] = useState(false);
  const [userEditModal, setUserEditModal] = useState(false);
  const [userResetModal, setUserResetModal] = useState(false);
  const [userDeleteModal, setUserDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<CognitoUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] =
    useState<CognitoUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<CognitoUser | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const clientStatusOptions: ClientStatus[] = ["ACTIVE", "INACTIVE"];
  const affiliateStatusOptions: AffiliateStatus[] = ["ACTIVE", "INACTIVE"];
  const [clientStatusEditing, setClientStatusEditing] = useState<string | null>(
    null,
  );
  const [clientStatusDraft, setClientStatusDraft] =
    useState<ClientStatus>("ACTIVE");
  const [affiliateStatusEditing, setAffiliateStatusEditing] = useState<
    string | null
  >(null);
  const [affiliateStatusDraft, setAffiliateStatusDraft] =
    useState<AffiliateStatus>("ACTIVE");

  const setQueryParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const {
    data: leads = [],
    isLoading: leadsLoading,
    mutate: refreshLeads,
  } = useSWR<Lead[]>("leads", async () => {
    try {
      const res = await listLeads();
      return (
        (res as any)?.data?.items ||
        (res as any)?.data ||
        (res as any)?.items ||
        []
      );
    } catch (error) {
      console.warn("Lead listing not available", error);
      return [] as Lead[];
    }
  });

  const {
    data: credentials = [],
    isLoading: credentialsLoading,
    mutate: refreshCredentials,
  } = useSWR<Credential[]>("credentials", async () => {
    try {
      const res = await listCredentials();
      return (
        (res as any)?.data?.items ||
        (res as any)?.data ||
        (res as any)?.items ||
        []
      );
    } catch (error) {
      console.warn("Credentials listing not available", error);
      return [] as Credential[];
    }
  });

  const {
    data: users = [],
    isLoading: usersLoading,
    mutate: refreshUsers,
  } = useSWR<CognitoUser[]>(
    active === "settings" && settingsTab === "users" ? "users" : null,
    async () => {
      try {
        const res = await listUsers();
        return (res as any)?.data || [];
      } catch (error) {
        console.warn("Users listing not available", error);
        return [] as CognitoUser[];
      }
    },
  );

  const {
    data: clients = [],
    isLoading: clientsLoading,
    mutate: refreshClients,
  } = useSWR<Client[]>("clients", async () => {
    const res = await listClients();
    return (
      (res as any)?.data?.items ||
      (res as any)?.data ||
      (res as any)?.items ||
      []
    );
  });

  const {
    data: affiliates = [],
    isLoading: affiliatesLoading,
    mutate: refreshAffiliates,
  } = useSWR<Affiliate[]>("affiliates", async () => {
    const res = await listAffiliates();
    return (
      (res as any)?.data?.items ||
      (res as any)?.data ||
      (res as any)?.items ||
      []
    );
  });

  const {
    data: campaigns = [],
    isLoading: campaignsLoading,
    mutate: refreshCampaigns,
  } = useSWR<Campaign[]>("campaigns", async () => {
    try {
      const res = await listCampaigns();
      return (
        (res as any)?.data?.items ||
        (res as any)?.data ||
        (res as any)?.items ||
        []
      );
    } catch (error) {
      console.warn(
        "Campaign listing not available, showing local only.",
        error,
      );
      return [] as Campaign[];
    }
  });

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return left - right;
    });
  }, [leads]);

  const campaignKeyMap = useMemo(() => {
    const map = new Map<string, { campaign: Campaign; affiliateId?: string }>();
    campaigns.forEach((c) => {
      (c.affiliates || []).forEach((a) => {
        if (a.campaign_key) {
          map.set(a.campaign_key, { campaign: c, affiliateId: a.affiliate_id });
        }
      });
    });
    return map;
  }, [campaigns]);

  const campaignIdMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    campaigns.forEach((c) => map.set(c.id, c));
    return map;
  }, [campaigns]);

  const affiliateIdMap = useMemo(() => {
    const map = new Map<string, Affiliate>();
    affiliates.forEach((a) => map.set(a.id, a));
    return map;
  }, [affiliates]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const role = currentUser?.role;

  useEffect(() => {
    const viewParam = searchParams?.get("view");
    if (
      viewParam &&
      [
        "home",
        "leads",
        "clients",
        "affiliates",
        "campaigns",
        "settings",
      ].includes(viewParam)
    ) {
      // Non-admins trying to deep-link to settings get bounced to home
      if (viewParam === "settings" && role !== "admin") {
        setActive("home");
        setQueryParams({ view: "home" });
        toast.error("Page not found.", { id: "settings-blocked" });
      } else {
        setActive(viewParam as NavKey);
      }
    }

    const campaignParam = searchParams?.get("campaign");
    if (campaignParam && campaigns.length > 0) {
      const found = campaigns.find((c) => c.id === campaignParam);
      if (found) {
        setSelectedCampaign(found);
        setCampaignDetailOpen(true);
        const sectionParam = searchParams?.get("section");
        const nextTab: CampaignDetailTab =
          sectionParam === "clients" ||
          sectionParam === "affiliates" ||
          sectionParam === "settings"
            ? (sectionParam as any)
            : "overview";
        setCampaignDetailTab(nextTab);
        setFocusedAffiliateId(searchParams?.get("affiliate") || null);
      }
    }
  }, [campaigns, searchParams, role]);

  const refreshCampaignsAndSelect = async (campaignId?: string) => {
    const data = await refreshCampaigns();
    if (campaignId && Array.isArray(data)) {
      const updated = data.find((c) => c.id === campaignId);
      if (updated) setSelectedCampaign(updated);
    }
  };

  const onSubmitCredential = async (payload: Credential) => {
    const promise = upsertCredential(payload);

    await toast.promise(promise, {
      loading: "Saving credential…",
      success: "Saved",
      error: (err) => err?.message || "Unable to save",
    });
    await refreshCredentials();
    setCredentialModal(false);
  };

  const onDeleteCredential = async (provider: string) => {
    const promise = deleteCredential(provider);
    await toast.promise(promise, {
      loading: "Deleting credential…",
      success: "Credential deleted",
      error: (err) => err?.message || "Unable to delete",
    });
    await refreshCredentials();
  };

  const onCreateUser = async (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: "admin" | "staff";
  }) => {
    await toast.promise(
      (async () => {
        const res = await createUser(payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to create user");
        await refreshUsers();
        setUserCreateModal(false);
      })(),
      {
        loading: "Creating user…",
        success: "User created",
        error: (err) => err?.message || "Unable to create user",
      },
    );
  };

  const onUpdateUser = async (
    id: string,
    payload: {
      role?: "admin" | "staff";
      firstName?: string;
      lastName?: string;
    },
  ) => {
    await toast.promise(
      (async () => {
        const res = await updateUser(id, payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to update user");
        await refreshUsers();
        setUserEditModal(false);
        setEditingUser(null);
      })(),
      {
        loading: "Updating user…",
        success: "User updated",
        error: (err) => err?.message || "Unable to update user",
      },
    );
  };

  const onResetUserPassword = async (id: string, password: string) => {
    await toast.promise(
      (async () => {
        const res = await resetUserPassword(id, password);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to reset password");
        await refreshUsers();
        setUserResetModal(false);
        setResetPasswordUser(null);
      })(),
      {
        loading: "Resetting password…",
        success: "Password reset",
        error: (err) => err?.message || "Unable to reset password",
      },
    );
  };

  const onDeleteUser = async (id: string) => {
    await toast.promise(
      (async () => {
        const res = await deleteUser(id);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to delete user");
        await refreshUsers();
        setUserDeleteModal(false);
        setDeletingUser(null);
      })(),
      {
        loading: "Deleting user…",
        success: "User deleted",
        error: (err) => err?.message || "Unable to delete user",
      },
    );
  };

  const title = useMemo(() => {
    switch (active) {
      case "home":
        return "Home";
      case "clients":
        return "Clients";
      case "affiliates":
        return "Affiliates";
      case "campaigns":
        return "Campaigns";
      case "settings":
        return "Settings";
      default:
        return "Leads";
    }
  }, [active]);

  const description = useMemo(() => {
    switch (active) {
      case "home":
        return "Welcome to Summit Edge Legal LMS";
      case "clients":
        return "Manage client lifecycle and codes";
      case "affiliates":
        return "Manage affiliate partners and status";
      case "campaigns":
        return "Configure campaigns, link clients/affiliates, and move statuses";
      case "settings":
        return "View and manage tenant credential entries";
      default:
        return "Review and manage incoming leads";
    }
  }, [active]);

  const handleNavChange = (next: NavKey) => {
    setActive(next);
    setSelectedCampaign(null);
    setCampaignDetailOpen(false);
    setFocusedAffiliateId(null);
    setCampaignDetailTab("overview");
    setQueryParams({
      view: next,
      campaign: undefined,
      section: undefined,
      affiliate: undefined,
    });
  };

  const handleRefresh = () => {
    if (active === "leads") refreshLeads();
    if (active === "clients") refreshClients();
    if (active === "affiliates") refreshAffiliates();
    if (active === "campaigns") refreshCampaigns();
    if (active === "settings") {
      if (settingsTab === "credentials") refreshCredentials();
      if (settingsTab === "users") refreshUsers();
    }
  };

  const openCampaign = (
    campaignId: string,
    section: CampaignDetailTab = "overview",
    affiliateId?: string,
  ) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      toast.error("Campaign not found");
      return;
    }
    setSelectedCampaign(campaign);
    setCampaignDetailTab(section);
    setFocusedAffiliateId(
      section === "affiliates" ? affiliateId || null : null,
    );
    setCampaignDetailOpen(true);
    setActive("campaigns");
    setQueryParams({
      view: "campaigns",
      campaign: campaignId,
      section,
      affiliate: section === "affiliates" ? affiliateId : undefined,
    });
  };

  const onCreateClient = async (payload: Partial<Client>) => {
    const promise = (async () => {
      const res = await createClient(payload);
      if (!(res as any)?.success) {
        throw new Error((res as any)?.message || "Unable to create client");
      }
      await refreshClients();
    })();
    await toast.promise(promise, {
      loading: "Creating client…",
      success: "Client created",
      error: (err) => err?.message || "Unable to create client",
    });
    setClientModal(false);
  };

  const onCreateAffiliate = async (payload: Partial<Affiliate>) => {
    const promise = (async () => {
      const res = await createAffiliate(payload);
      if (!(res as any)?.success) {
        throw new Error((res as any)?.message || "Unable to create affiliate");
      }
      await refreshAffiliates();
    })();
    await toast.promise(promise, {
      loading: "Creating affiliate…",
      success: "Affiliate created",
      error: (err) => err?.message || "Unable to create affiliate",
    });
    setAffiliateModal(false);
  };

  const onCreateCampaign = async (payload: { name: string }) => {
    const promise = createCampaign(payload).then(() => refreshCampaigns());
    await toast.promise(promise, {
      loading: "Creating campaign…",
      success: "Campaign created (DRAFT)",
      error: (err) => err?.message || "Unable to create campaign",
    });
    setCampaignModal(false);
  };

  const onLinkClientToCampaign = async (
    campaignId: string,
    clientId: string,
  ) => {
    const promise = linkClientToCampaign(campaignId, clientId);
    await toast.promise(promise, {
      loading: "Linking client…",
      success: "Client linked",
      error: (err) => err?.message || "Unable to link client",
    });
    await refreshCampaignsAndSelect(campaignId);
    setActive("campaigns");
  };

  const onLinkAffiliateToCampaign = async (
    campaignId: string,
    affiliateId: string,
  ) => {
    const promise = linkAffiliateToCampaign(campaignId, affiliateId);
    await toast.promise(promise, {
      loading: "Linking affiliate…",
      success: "Affiliate linked (campaign key refreshed)",
      error: (err) => err?.message || "Unable to link affiliate",
    });
    await refreshCampaignsAndSelect(campaignId);
    setActive("campaigns");
  };

  const onUpdateClientLinkStatus = async (
    campaignId: string,
    clientId: string,
    status: CampaignParticipantStatus,
  ) => {
    const promise = updateCampaignClientStatus(campaignId, clientId, status);
    await toast.promise(promise, {
      loading: "Updating client status…",
      success: "Client status updated",
      error: (err) => err?.message || "Unable to update client status",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateAffiliateLinkStatus = async (
    campaignId: string,
    affiliateId: string,
    status: CampaignParticipantStatus,
  ) => {
    const promise = updateCampaignAffiliateStatus(
      campaignId,
      affiliateId,
      status,
    );
    await toast.promise(promise, {
      loading: "Updating affiliate status…",
      success: "Affiliate status updated",
      error: (err) => err?.message || "Unable to update affiliate status",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onRemoveClientFromCampaign = async (
    campaignId: string,
    clientId: string,
  ) => {
    const promise = removeClientFromCampaign(campaignId, clientId);
    await toast.promise(promise, {
      loading: "Removing client…",
      success: "Client removed from campaign",
      error: (err) => err?.message || "Unable to remove client",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onRemoveAffiliateFromCampaign = async (
    campaignId: string,
    affiliateId: string,
  ) => {
    const promise = removeAffiliateFromCampaign(campaignId, affiliateId);
    await toast.promise(promise, {
      loading: "Removing affiliate…",
      success: "Affiliate removed from campaign",
      error: (err) => err?.message || "Unable to remove affiliate",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateCampaignStatus = async (
    id: string,
    status: Campaign["status"],
  ) => {
    const toastId = toast.loading("Updating status…");
    try {
      const res = await updateCampaignStatus(id, status);
      if (!(res as any)?.success) {
        toast.warning(
          (res as any)?.error || res?.message || "Unable to update status",
          { id: toastId },
        );
        return false;
      }
      await refreshCampaignsAndSelect(id);
      toast.success("Status updated", { id: toastId });
      return true;
    } catch (error: any) {
      toast.warning(
        error?.message ||
          "Unable to update status. Add a client or affiliate first.",
        { id: toastId },
      );
      return false;
    }
  };

  const onUpdateCampaignPlugins = async (
    campaignId: string,
    payload: {
      duplicate_check?: {
        enabled?: boolean;
        criteria?: Array<"phone" | "email">;
      };
    },
  ) => {
    const promise = updateCampaignPlugins(campaignId, payload);
    await toast.promise(promise, {
      loading: "Updating quality controls…",
      success: "Quality controls updated",
      error: (err) => err?.message || "Unable to update quality controls",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const removeClient = async (id: string) => {
    const promise = deleteClient(id).then(() => refreshClients());
    await toast.promise(promise, {
      loading: "Removing client…",
      success: "Client removed",
      error: (err) => err?.message || "Unable to remove client",
    });
  };

  const removeAffiliate = async (id: string) => {
    const promise = deleteAffiliate(id).then(() => refreshAffiliates());
    await toast.promise(promise, {
      loading: "Removing affiliate…",
      success: "Affiliate removed",
      error: (err) => err?.message || "Unable to remove affiliate",
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-bg] text-[--color-text]">
      <Sidebar
        active={active}
        onChange={handleNavChange}
        onLogoClick={() => handleNavChange("home")}
        role={currentUser?.role}
      />

      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <h1 className="mt-2 text-2xl font-semibold text-[--color-text-strong]">
                  {title}
                </h1>
                <p className="text-sm text-[--color-text-muted]">
                  {description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              iconLeft={<RefreshCcw size={16} />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <ThemeToggle />
            {/* User avatar */}
            {currentUser && (
              <div className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[--color-primary] text-xs font-bold text-white select-none">
                  {userInitials(currentUser)}
                </div>
                <div className="hidden flex-col sm:flex min-w-0">
                  <span className="text-xs font-semibold text-[--color-text-strong] leading-tight whitespace-nowrap">
                    {userDisplayName(currentUser)}
                  </span>
                  <span className="text-[10px] text-[--color-text-muted] capitalize leading-tight">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  title="Sign out"
                  className="ml-1 shrink-0 text-[--color-text-muted] hover:text-[--color-danger] transition-colors"
                  onClick={onSignOut}
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {active === "home" && (
            <motion.section
              key="home"
              className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] px-16 py-14 flex flex-col items-center gap-3 shadow-inner">
                <p className="text-4xl select-none">📊</p>
                <p className="text-lg font-semibold text-[--color-text-strong]">
                  Metrics &amp; Dashboard
                </p>
                <p className="text-sm text-[--color-text-muted] max-w-xs">
                  This area will show key performance metrics, summaries, and
                  insights. Coming soon.
                </p>
              </div>
            </motion.section>
          )}
          {active === "leads" && (
            <motion.section
              key="leads"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-[--color-text-muted]">
                  Live lead feed from the API; use Refresh to sync.
                </div>
              </div>

              <Table
                columns={[
                  {
                    key: "id",
                    label: "ID",
                    width: "120px",
                    render: (lead) => (
                      <span className="font-medium">{lead.id}</span>
                    ),
                  },
                  {
                    key: "campaign_id",
                    label: "Campaign",
                    width: "180px",
                    render: (lead) => (
                      <button
                        type="button"
                        className="text-[--color-primary] underline underline-offset-2"
                        onClick={() => openCampaign(lead.campaign_id)}
                      >
                        {campaignIdMap.get(lead.campaign_id)?.name ||
                          lead.campaign_id}
                      </button>
                    ),
                  },
                  {
                    key: "campaign_key",
                    label: "Affiliate",
                    width: "180px",
                    render: (lead) => {
                      const mapping = campaignKeyMap.get(
                        lead.campaign_key || "",
                      );
                      if (!mapping) return lead.campaign_key || "";
                      const affiliateName = mapping.affiliateId
                        ? affiliateIdMap.get(mapping.affiliateId)?.name
                        : null;
                      return (
                        <button
                          type="button"
                          className="text-[--color-primary] underline underline-offset-2"
                          onClick={() =>
                            openCampaign(
                              mapping.campaign.id,
                              "affiliates",
                              mapping.affiliateId,
                            )
                          }
                        >
                          {affiliateName || lead.campaign_key || ""}
                        </button>
                      );
                    },
                  },
                  {
                    key: "test",
                    label: "Mode",
                    width: "96px",
                    render: (lead) => (
                      <Badge tone={lead.test ? "info" : "success"}>
                        {lead.test ? "Test" : "Live"}
                      </Badge>
                    ),
                  },
                  {
                    key: "qa_duplicate",
                    label: "Duplicate",
                    width: "96px",
                    render: (lead) => (
                      <div className="mx-auto flex w-fit items-center justify-center">
                        {lead.duplicate ? (
                          <X size={18} className="text-[--color-danger]" />
                        ) : (
                          <Check size={18} className="text-[--color-success]" />
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    width: "160px",
                    render: (lead) => formatCompactDateTime(lead.created_at),
                  },
                  {
                    key: "intake_status",
                    label: "Status",
                    width: "112px",
                    render: (lead) => (
                      <Badge tone={lead.rejected ? "danger" : "success"}>
                        {lead.rejected ? "Rejected" : "Accepted"}
                      </Badge>
                    ),
                  },
                  {
                    key: "payload",
                    label: "Details",
                    render: (lead) => (
                      <PayloadPreview lead={lead} allLeads={sortedLeads} />
                    ),
                  },
                ]}
                data={sortedLeads}
                emptyLabel={
                  leadsLoading ? "Loading leads…" : "No leads available."
                }
              />
            </motion.section>
          )}

          {active === "clients" && (
            <motion.section
              key="clients"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[--color-text-muted]">
                  Create, update, or disable clients.
                </p>
                <Button
                  iconLeft={<Plus size={16} />}
                  onClick={() => setClientModal(true)}
                >
                  New Client
                </Button>
              </div>
              <Table
                columns={[
                  {
                    key: "name",
                    label: "Name",
                    render: (client) => (
                      <span className="font-medium text-[--color-text-strong]">
                        {client.name}
                      </span>
                    ),
                  },
                  { key: "email", label: "Email" },
                  {
                    key: "phone",
                    label: "Phone",
                    render: (client) => formatPhone(client.phone),
                  },
                  { key: "client_code", label: "Code" },
                  {
                    key: "status",
                    label: "Status",
                    render: (client) => {
                      const isEditing = clientStatusEditing === client.id;
                      const current = isEditing
                        ? clientStatusDraft
                        : client.status;
                      return isEditing ? (
                        <div className="flex items-center gap-2">
                          <select
                            className={inputClass}
                            value={current}
                            onChange={(e) =>
                              setClientStatusDraft(
                                e.target.value as ClientStatus,
                              )
                            }
                          >
                            {clientStatusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await updateClient(client.id, {
                                status: clientStatusDraft,
                              });
                              setClientStatusEditing(null);
                              refreshClients();
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setClientStatusEditing(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md"
                          onClick={() => {
                            setClientStatusDraft(client.status);
                            setClientStatusEditing(client.id);
                          }}
                        >
                          <Badge
                            tone={statusColorMap[client.status] || "neutral"}
                          >
                            {client.status}
                          </Badge>
                        </button>
                      );
                    },
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (client) => formatDate(client.created_at),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (client) => (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeClient(client.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={clients}
                emptyLabel={
                  clientsLoading
                    ? "Loading clients…"
                    : "No clients yet. Add one."
                }
              />
            </motion.section>
          )}

          {active === "affiliates" && (
            <motion.section
              key="affiliates"
              className="space-y-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[--color-text-muted]">
                  Manage affiliate partners and their lifecycle.
                </p>
                <Button
                  iconLeft={<Plus size={16} />}
                  onClick={() => setAffiliateModal(true)}
                >
                  New Affiliate
                </Button>
              </div>
              <Table
                columns={[
                  {
                    key: "name",
                    label: "Name",
                    render: (a) => (
                      <span className="font-medium text-[--color-text-strong]">
                        {a.name}
                      </span>
                    ),
                  },
                  { key: "email", label: "Email" },
                  {
                    key: "phone",
                    label: "Phone",
                    render: (a) => formatPhone(a.phone),
                  },
                  { key: "affiliate_code", label: "Code" },
                  {
                    key: "status",
                    label: "Status",
                    render: (a) => {
                      const isEditing = affiliateStatusEditing === a.id;
                      const current = isEditing
                        ? affiliateStatusDraft
                        : a.status;
                      return isEditing ? (
                        <div className="flex items-center gap-2">
                          <select
                            className={inputClass}
                            value={current}
                            onChange={(e) =>
                              setAffiliateStatusDraft(
                                e.target.value as AffiliateStatus,
                              )
                            }
                          >
                            {affiliateStatusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await updateAffiliate(a.id, {
                                status: affiliateStatusDraft,
                              });
                              setAffiliateStatusEditing(null);
                              refreshAffiliates();
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAffiliateStatusEditing(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="rounded-md"
                          onClick={() => {
                            setAffiliateStatusDraft(a.status);
                            setAffiliateStatusEditing(a.id);
                          }}
                        >
                          <Badge tone={statusColorMap[a.status] || "neutral"}>
                            {a.status}
                          </Badge>
                        </button>
                      );
                    },
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (a) => formatDate(a.created_at),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (a) => (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeAffiliate(a.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={affiliates}
                emptyLabel={
                  affiliatesLoading
                    ? "Loading affiliates…"
                    : "No affiliates yet. Add one."
                }
              />
            </motion.section>
          )}

          {active === "campaigns" && (
            <motion.section
              key="campaigns"
              className="space-y-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-[--color-text-muted]">
                  Campaigns start as DRAFT. Link a client or affiliate, then
                  move to TEST and ACTIVE.
                </p>
                <Button
                  iconLeft={<Plus size={16} />}
                  onClick={() => setCampaignModal(true)}
                >
                  New Campaign
                </Button>
              </div>

              <Table
                columns={[
                  {
                    key: "name",
                    label: "Name",
                    render: (c) => (
                      <span className="font-medium text-[--color-text-strong]">
                        {c.name}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (c) => (
                      <Badge tone={statusColorMap[c.status] || "neutral"}>
                        {c.status}
                      </Badge>
                    ),
                  },
                  {
                    key: "clients",
                    label: "Clients",
                    render: (c) => c.clients?.length || 0,
                  },
                  {
                    key: "affiliates",
                    label: "Affiliates",
                    render: (c) => c.affiliates?.length || 0,
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (c) => formatDate(c.created_at),
                  },
                  {
                    key: "chevron",
                    label: "",
                    render: () => (
                      <ChevronRight
                        size={16}
                        className="text-[--color-text-muted]"
                      />
                    ),
                  },
                ]}
                data={campaigns}
                onRowClick={(c) => {
                  openCampaign(c.id, "overview");
                }}
                emptyLabel={
                  campaignsLoading
                    ? "Loading campaigns…"
                    : "No campaigns yet. Add one."
                }
              />
            </motion.section>
          )}

          {active === "settings" && role !== "admin" ? (
            <motion.section
              key="not-found"
              className="flex flex-col items-center justify-center py-32 gap-4"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <p className="text-5xl font-bold text-[--color-text-muted] select-none">
                404
              </p>
              <p className="text-lg font-medium text-[--color-text-strong]">
                Page not found
              </p>
              <p className="text-sm text-[--color-text-muted]">
                You don&apos;t have permission to view this page.
              </p>
              <button
                type="button"
                className="mt-2 text-sm text-[--color-primary] hover:underline"
                onClick={() => handleNavChange("leads")}
              >
                Go to Leads
              </button>
            </motion.section>
          ) : (
            active === "settings" && (
              <motion.section
                key="settings"
                className="space-y-5"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {/* Sub-nav tabs */}
                <div className="flex gap-1 rounded-lg border border-[--color-border] bg-[--color-panel] p-1 w-fit">
                  {(["credentials", "users"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSettingsTab(tab)}
                      className={
                        settingsTab === tab
                          ? "rounded-md px-4 py-1.5 text-sm font-medium bg-[--color-primary] text-white transition-colors"
                          : "rounded-md px-4 py-1.5 text-sm font-medium text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                      }
                    >
                      {tab === "credentials" ? "Credentials" : "Users"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {settingsTab === "credentials" && (
                    <motion.div
                      key="credentials"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-medium text-[--color-text-strong]">
                            Credentials
                          </h2>
                          <p className="text-sm text-[--color-text-muted]">
                            API credentials for third-party integrations.
                          </p>
                        </div>
                        <Button
                          iconLeft={<Plus size={16} />}
                          onClick={() => {
                            setEditingCredential(null);
                            setCredentialModal(true);
                          }}
                        >
                          Add Credential
                        </Button>
                      </div>
                      <Table
                        columns={[
                          {
                            key: "provider",
                            label: "Provider",
                            render: (c) => (
                              <span className="font-medium text-[--color-text-strong]">
                                {c.provider}
                              </span>
                            ),
                          },
                          {
                            key: "type",
                            label: "Type",
                            render: (c) => (
                              <Badge tone="neutral">{c.type}</Badge>
                            ),
                          },
                          {
                            key: "updated_at",
                            label: "Updated",
                            render: (c) =>
                              c.updated_at ? formatDate(c.updated_at) : "—",
                          },
                          {
                            key: "actions",
                            label: "Actions",
                            render: (c) => (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingCredential(c);
                                    setCredentialModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => onDeleteCredential(c.provider)}
                                >
                                  Delete
                                </Button>
                              </div>
                            ),
                          },
                        ]}
                        data={credentials}
                        emptyLabel={
                          credentialsLoading
                            ? "Loading credentials…"
                            : "No credentials yet. Add one."
                        }
                      />
                    </motion.div>
                  )}

                  {settingsTab === "users" && (
                    <motion.div
                      key="users"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-medium text-[--color-text-strong]">
                            Users
                          </h2>
                          <p className="text-sm text-[--color-text-muted]">
                            Manage Cognito user accounts and roles.
                          </p>
                        </div>
                        <Button
                          iconLeft={<UserPlus size={16} />}
                          onClick={() => setUserCreateModal(true)}
                        >
                          Add User
                        </Button>
                      </div>
                      <input
                        className={inputClass}
                        placeholder="Search by name or email…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                      <Table
                        columns={[
                          {
                            key: "email",
                            label: "Email",
                            render: (u) => (
                              <span className="font-medium text-[--color-text-strong]">
                                {u.email}
                              </span>
                            ),
                          },
                          {
                            key: "name",
                            label: "Name",
                            render: (u) =>
                              [u.firstName, u.lastName]
                                .filter(Boolean)
                                .join(" ") || "—",
                          },
                          {
                            key: "role",
                            label: "Role",
                            render: (u) => (
                              <Badge
                                tone={u.role === "admin" ? "info" : "neutral"}
                              >
                                {u.role}
                              </Badge>
                            ),
                          },
                          {
                            key: "status",
                            label: "Status",
                            render: (u) => (
                              <Badge
                                tone={
                                  u.enabled !== false ? "success" : "danger"
                                }
                              >
                                {u.status ||
                                  (u.enabled !== false
                                    ? "Confirmed"
                                    : "Disabled")}
                              </Badge>
                            ),
                          },
                          {
                            key: "createdAt",
                            label: "Created",
                            render: (u) =>
                              u.createdAt ? formatDate(u.createdAt) : "—",
                          },
                          {
                            key: "actions",
                            label: "Actions",
                            render: (u) => (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  iconLeft={<UserCog size={14} />}
                                  onClick={() => {
                                    setEditingUser(u);
                                    setUserEditModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  iconLeft={<KeyRound size={14} />}
                                  onClick={() => {
                                    setResetPasswordUser(u);
                                    setUserResetModal(true);
                                  }}
                                >
                                  Reset PW
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  iconLeft={<Trash2 size={14} />}
                                  onClick={() => {
                                    setDeletingUser(u);
                                    setUserDeleteModal(true);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            ),
                          },
                        ]}
                        data={filteredUsers}
                        emptyLabel={
                          usersLoading ? "Loading users…" : "No users found."
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <ClientModal
        isOpen={clientModal}
        onClose={() => setClientModal(false)}
        onSubmit={onCreateClient}
      />
      <AffiliateModal
        isOpen={affiliateModal}
        onClose={() => setAffiliateModal(false)}
        onSubmit={onCreateAffiliate}
      />
      <CampaignModal
        isOpen={campaignModal}
        onClose={() => setCampaignModal(false)}
        onSubmit={onCreateCampaign}
      />
      <CredentialModal
        isOpen={credentialModal}
        onClose={() => {
          setCredentialModal(false);
          setEditingCredential(null);
        }}
        onSubmit={onSubmitCredential}
        initial={editingCredential}
      />
      <CreateUserModal
        isOpen={userCreateModal}
        onClose={() => setUserCreateModal(false)}
        onSubmit={onCreateUser}
      />
      <EditUserModal
        user={editingUser}
        isOpen={userEditModal}
        onClose={() => {
          setUserEditModal(false);
          setEditingUser(null);
        }}
        onSubmit={onUpdateUser}
      />
      <ResetPasswordModal
        user={resetPasswordUser}
        isOpen={userResetModal}
        onClose={() => {
          setUserResetModal(false);
          setResetPasswordUser(null);
        }}
        onSubmit={onResetUserPassword}
      />
      <DeleteUserModal
        user={deletingUser}
        isOpen={userDeleteModal}
        onClose={() => {
          setUserDeleteModal(false);
          setDeletingUser(null);
        }}
        onConfirm={onDeleteUser}
      />
      <CampaignDetailModal
        campaign={selectedCampaign}
        clients={clients}
        affiliates={affiliates}
        leads={leads}
        isOpen={campaignDetailOpen}
        onClose={() => {
          setCampaignDetailOpen(false);
          setSelectedCampaign(null);
          setFocusedAffiliateId(null);
          setCampaignDetailTab("overview");
          setQueryParams({
            campaign: undefined,
            section: undefined,
            affiliate: undefined,
            view: active !== "leads" ? active : undefined,
          });
        }}
        onStatusChange={onUpdateCampaignStatus}
        onLinkClient={onLinkClientToCampaign}
        onLinkAffiliate={onLinkAffiliateToCampaign}
        onUpdateClientStatus={onUpdateClientLinkStatus}
        onUpdateAffiliateStatus={onUpdateAffiliateLinkStatus}
        onRemoveClient={onRemoveClientFromCampaign}
        onRemoveAffiliate={onRemoveAffiliateFromCampaign}
        onUpdatePlugins={onUpdateCampaignPlugins}
        onTabChange={(tab) => {
          setCampaignDetailTab(tab);
          if (tab !== "affiliates") setFocusedAffiliateId(null);
          setQueryParams({
            view: "campaigns",
            campaign: selectedCampaign?.id,
            section: tab,
            affiliate:
              tab === "affiliates"
                ? focusedAffiliateId || undefined
                : undefined,
          });
        }}
        focusAffiliateId={focusedAffiliateId}
        tab={campaignDetailTab}
      />
    </div>
  );
}

function PayloadPreview({ lead, allLeads }: { lead: Lead; allLeads: Lead[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"payload" | "quality-control">(
    "payload",
  );
  const [qualityTab, setQualityTab] =
    useState<"duplicate-check">("duplicate-check");
  const [selectedLead, setSelectedLead] = useState<Lead>(lead);

  const setLeadQueryParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const currentLead = selectedLead;
  const entries = Object.entries(currentLead.payload || {});
  const duplicateLeadIds = currentLead.duplicate_matches?.lead_ids || [];
  const duplicateFailed = Boolean(currentLead.duplicate);

  useEffect(() => {
    const leadId = searchParams?.get("lead");
    if (!leadId) return;

    const targetLead = allLeads.find((item) => item.id === leadId);
    if (!targetLead || targetLead.id !== lead.id) return;

    setSelectedLead(targetLead);
    setIsOpen(true);

    const tabParam = searchParams?.get("leadTab");
    if (tabParam === "payload" || tabParam === "quality-control") {
      setActiveTab(tabParam);
    }

    const qualityParam = searchParams?.get("leadQc");
    if (qualityParam === "duplicate-check") {
      setQualityTab("duplicate-check");
    }
  }, [allLeads, lead.id, searchParams]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-[--color-primary] text-[--color-bg] hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]"
        onClick={() => {
          setSelectedLead(lead);
          setIsOpen(true);
          setActiveTab("payload");
          setQualityTab("duplicate-check");
          setLeadQueryParams({
            view: undefined,
            campaign: undefined,
            section: undefined,
            affiliate: undefined,
            lead: lead.id,
            leadTab: "payload",
            leadQc: undefined,
          });
        }}
      >
        View
      </Button>

      <Modal
        title="Lead Details"
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setActiveTab("payload");
          setQualityTab("duplicate-check");
          setSelectedLead(lead);
          setLeadQueryParams({
            lead: undefined,
            leadTab: undefined,
            leadQc: undefined,
          });
        }}
        width={720}
      >
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Lead ID" value={currentLead.id} />
            <InfoItem label="Mode" value={currentLead.test ? "Test" : "Live"} />
            <InfoItem label="Campaign" value={currentLead.campaign_id} />
            <InfoItem label="Campaign Key" value={currentLead.campaign_key} />
            <InfoItem
              label="Affiliate Status at Intake"
              value={currentLead.affiliate_status_at_intake || "—"}
            />
            <InfoItem
              label="Created (UTC)"
              value={formatUtcDateTime(currentLead.created_at)}
            />
            <InfoItem
              label="Created (Local)"
              value={formatLocalDateTimeWithZone(currentLead.created_at)}
            />
          </div>

          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Lead detail sections"
              className="flex items-center gap-4 border-b border-[--color-border]"
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab("payload");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "payload",
                    leadQc: undefined,
                  });
                }}
                aria-selected={activeTab === "payload"}
                role="tab"
                className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
                  activeTab === "payload"
                    ? "border-[--color-primary] text-[--color-text-strong]"
                    : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
                }`}
              >
                Payload
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("quality-control");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "quality-control",
                    leadQc: "duplicate-check",
                  });
                }}
                aria-selected={activeTab === "quality-control"}
                role="tab"
                className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
                  activeTab === "quality-control"
                    ? "border-[--color-primary] text-[--color-text-strong]"
                    : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
                }`}
              >
                Quality Control
              </button>
            </div>

            {activeTab === "payload" ? (
              <div className="space-y-2">
                {entries.length === 0 ? (
                  <p className="text-[--color-text-muted]">Empty payload</p>
                ) : (
                  <div className="space-y-2">
                    {entries.map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                          {key}
                        </p>
                        <input
                          readOnly
                          className={inputClass}
                          value={
                            typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  role="tablist"
                  aria-label="Quality control modules"
                  className="flex items-center gap-4 border-b border-[--color-border]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setQualityTab("duplicate-check");
                      setLeadQueryParams({
                        lead: currentLead.id,
                        leadTab: "quality-control",
                        leadQc: "duplicate-check",
                      });
                    }}
                    aria-selected={qualityTab === "duplicate-check"}
                    role="tab"
                    className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
                      qualityTab === "duplicate-check"
                        ? "border-[--color-primary] text-[--color-text-strong]"
                        : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
                    }`}
                  >
                    Duplicate Check
                  </button>
                </div>

                {qualityTab === "duplicate-check" ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                        Duplicate Check
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {duplicateFailed ? (
                          <X size={16} className="text-[--color-danger]" />
                        ) : (
                          <Check size={16} className="text-[--color-success]" />
                        )}
                        <span
                          className={`font-semibold ${
                            duplicateFailed
                              ? "text-[--color-danger]"
                              : "text-[--color-success]"
                          }`}
                        >
                          {duplicateFailed ? "Fail" : "Passed"}
                        </span>
                      </div>
                    </div>

                    {duplicateLeadIds.length > 0 ? (
                      <details className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                        <summary className="cursor-pointer text-sm font-medium text-[--color-text-strong]">
                          Matched Leads ({duplicateLeadIds.length})
                        </summary>
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-2">
                            {duplicateLeadIds.map((leadId) => (
                              <button
                                key={leadId}
                                type="button"
                                className="rounded-md"
                                onClick={() => {
                                  const matchedLead = allLeads.find(
                                    (item) => item.id === leadId,
                                  );
                                  if (!matchedLead) {
                                    toast.warning(
                                      "Matched lead is not available in the current list.",
                                    );
                                    return;
                                  }
                                  setSelectedLead(matchedLead);
                                  setActiveTab("payload");
                                  setQualityTab("duplicate-check");
                                  setLeadQueryParams({
                                    lead: matchedLead.id,
                                    leadTab: "payload",
                                    leadQc: undefined,
                                  });
                                }}
                              >
                                <Badge tone="warning">{leadId}</Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function CampaignDetailModal({
  campaign,
  clients,
  affiliates,
  leads,
  isOpen,
  onClose,
  onStatusChange,
  onLinkClient,
  onLinkAffiliate,
  onUpdateClientStatus,
  onUpdateAffiliateStatus,
  onRemoveClient,
  onRemoveAffiliate,
  onUpdatePlugins,
  tab,
  onTabChange,
  focusAffiliateId,
}: {
  campaign: Campaign | null;
  clients: Client[];
  affiliates: Affiliate[];
  leads: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: Campaign["status"]) => Promise<boolean>;
  onLinkClient: (campaignId: string, clientId: string) => Promise<void>;
  onLinkAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
  onUpdateClientStatus: (
    campaignId: string,
    clientId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onUpdateAffiliateStatus: (
    campaignId: string,
    affiliateId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onRemoveClient: (campaignId: string, clientId: string) => Promise<void>;
  onRemoveAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
  onUpdatePlugins: (
    campaignId: string,
    payload: {
      duplicate_check?: {
        enabled?: boolean;
        criteria?: Array<"phone" | "email">;
      };
    },
  ) => Promise<void>;
  tab: CampaignDetailTab;
  onTabChange: (tab: CampaignDetailTab) => void;
  focusAffiliateId: string | null;
}) {
  const [statusEditing, setStatusEditing] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Campaign["status"]>("DRAFT");
  const [linkClientModalOpen, setLinkClientModalOpen] = useState(false);
  const [linkAffiliateModalOpen, setLinkAffiliateModalOpen] = useState(false);
  const participantStatusOptions: CampaignParticipantStatus[] = [
    "TEST",
    "LIVE",
    "DISABLED",
  ];
  const [clientStatusDrafts, setClientStatusDrafts] = useState<
    Record<string, CampaignParticipantStatus>
  >({});
  const [affiliateStatusDrafts, setAffiliateStatusDrafts] = useState<
    Record<string, CampaignParticipantStatus>
  >({});
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(true);
  const [duplicateCheckCriteria, setDuplicateCheckCriteria] = useState<
    Array<"phone" | "email">
  >(["phone", "email"]);

  useEffect(() => {
    if (campaign) {
      setStatusDraft(campaign.status);
      setDuplicateCheckEnabled(
        campaign.plugins?.duplicate_check?.enabled ?? true,
      );
      setDuplicateCheckCriteria(
        campaign.plugins?.duplicate_check?.criteria?.length
          ? campaign.plugins.duplicate_check.criteria
          : ["phone", "email"],
      );
    }
  }, [campaign]);

  if (!campaign) return null;

  const clientLinks = campaign.clients || [];
  const affiliateLinks = campaign.affiliates || [];
  const clientLinkMap = new Map(clientLinks.map((cc) => [cc.client_id, cc]));
  const affiliateLinkMap = new Map(
    affiliateLinks.map((ca) => [ca.affiliate_id, ca]),
  );

  const linkedClients = clients.filter((c) => clientLinkMap.has(c.id));
  const linkedAffiliates = affiliates.filter((a) => affiliateLinkMap.has(a.id));
  const leadsForCampaign = leads.filter((l) => l.campaign_id === campaign.id);

  const availableClients = clients.filter(
    (c) => c.status === "ACTIVE" && !clientLinkMap.has(c.id),
  );
  const availableAffiliates = affiliates.filter(
    (a) => a.status === "ACTIVE" && !affiliateLinkMap.has(a.id),
  );

  return (
    <>
      <Modal
        title={campaign.name}
        isOpen={isOpen}
        onClose={() => {
          setStatusEditing(false);
          setStatusDraft(campaign.status);
          onClose();
        }}
        width={900}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge tone={statusColorMap[campaign.status] || "neutral"}>
                {campaign.status}
              </Badge>
              <span className="text-sm text-[--color-text-muted]">
                ID: {campaign.id}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusEditing ? (
                <>
                  <select
                    className={inputClass}
                    value={statusDraft}
                    onChange={(e) =>
                      setStatusDraft(e.target.value as Campaign["status"])
                    }
                  >
                    {(
                      [
                        "DRAFT",
                        "TEST",
                        "ACTIVE",
                        "INACTIVE",
                      ] as Campaign["status"][]
                    ).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const ok = await onStatusChange(campaign.id, statusDraft);
                      if (ok) setStatusEditing(false);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStatusDraft(campaign.status);
                      setStatusEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatusDraft(campaign.status);
                    setStatusEditing(true);
                  }}
                >
                  Edit Status
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-6">
            <nav className="w-44 shrink-0 space-y-1">
              {(
                [
                  { key: "overview", label: "Overview", icon: LayoutGrid },
                  { key: "clients", label: "Clients", icon: Users },
                  { key: "affiliates", label: "Affiliates", icon: HandHeart },
                  { key: "settings", label: "Settings", icon: Settings2 },
                ] as const
              ).map((item) => {
                const Icon = item.icon || Link2;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active ? "bg-[--color-panel] text-[--color-text-strong]" : "text-[--color-text-muted] hover:text-[--color-text]"}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 space-y-4">
              {tab === "overview" && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                    <InfoItem
                      label="Created"
                      value={formatDateTime(campaign.created_at)}
                    />
                    <InfoItem
                      label="Updated"
                      value={formatDateTime(campaign.updated_at)}
                    />
                    <InfoItem
                      label="Lead Count"
                      value={leadsForCampaign.length.toString()}
                    />
                    <InfoItem
                      label="Linked Clients"
                      value={linkedClients.length.toString()}
                      onClick={() => onTabChange("clients")}
                    />
                    <InfoItem
                      label="Linked Affiliates"
                      value={linkedAffiliates.length.toString()}
                      onClick={() => onTabChange("affiliates")}
                    />
                  </div>

                  {campaign.status_history?.length ? (
                    <div className="space-y-2">
                      <SectionLabel>Status History</SectionLabel>
                      <ul className="space-y-2 text-sm">
                        {campaign.status_history.map((step, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-2 text-[--color-text]"
                          >
                            <ArrowRight size={14} />
                            <span className="font-semibold">{step.from}</span>
                            <span className="text-[--color-text-muted]">→</span>
                            <span className="font-semibold">{step.to}</span>
                            <span className="text-[--color-text-muted]">
                              on {formatDateTime(step.changed_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}

              {tab === "clients" && (
                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <SectionLabel>Linked Clients</SectionLabel>
                    <Button
                      size="sm"
                      iconLeft={<UserPlus size={14} />}
                      disabled={availableClients.length === 0}
                      onClick={() => setLinkClientModalOpen(true)}
                    >
                      Add Client
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {linkedClients.length === 0 ? (
                      <p className="text-[--color-text-muted]">
                        No linked clients yet.
                      </p>
                    ) : (
                      linkedClients.map((c) => {
                        const link = clientLinkMap.get(c.id);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between rounded-md bg-[--color-panel] px-3 py-2"
                          >
                            <div>
                              <div className="font-semibold text-[--color-text-strong]">
                                {c.name}
                              </div>
                              <div className="text-[--color-text-muted]">
                                {c.email}
                              </div>
                              <div className="text-[--color-text-muted] text-xs">
                                Added:{" "}
                                {link?.added_at
                                  ? formatDateTime(link.added_at)
                                  : "—"}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <select
                                  className={`${inputClass} w-28 text-xs`}
                                  value={
                                    clientStatusDrafts[c.id] ||
                                    link?.status ||
                                    "TEST"
                                  }
                                  onChange={(e) =>
                                    setClientStatusDrafts((prev) => ({
                                      ...prev,
                                      [c.id]: e.target
                                        .value as CampaignParticipantStatus,
                                    }))
                                  }
                                >
                                  {participantStatusOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const status =
                                      clientStatusDrafts[c.id] ||
                                      link?.status ||
                                      "TEST";
                                    await onUpdateClientStatus(
                                      campaign.id,
                                      c.id,
                                      status,
                                    );
                                  }}
                                >
                                  Update
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  tone={
                                    statusColorMap[link?.status || "TEST"] ||
                                    "neutral"
                                  }
                                >
                                  Campaign: {link?.status || "TEST"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () =>
                                    onRemoveClient(campaign.id, c.id)
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {tab === "affiliates" && (
                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <SectionLabel>Linked Affiliates</SectionLabel>
                    <Button
                      size="sm"
                      iconLeft={<UserPlus size={14} />}
                      disabled={availableAffiliates.length === 0}
                      onClick={() => setLinkAffiliateModalOpen(true)}
                    >
                      Add Affiliate
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    {linkedAffiliates.length === 0 ? (
                      <p className="text-[--color-text-muted]">
                        No linked affiliates yet.
                      </p>
                    ) : (
                      linkedAffiliates.map((a) => {
                        const link = affiliateLinkMap.get(a.id);
                        const isFocused = focusAffiliateId === a.id;
                        return (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between rounded-md bg-[--color-panel] px-3 py-2 ${isFocused ? "ring-2 ring-[--color-primary]" : ""}`}
                          >
                            <div>
                              <div className="font-semibold text-[--color-text-strong]">
                                {a.name}
                              </div>
                              {a.affiliate_code ? (
                                <div className="text-[--color-text-muted] text-xs">
                                  Code: {a.affiliate_code}
                                </div>
                              ) : null}
                              {link?.campaign_key ? (
                                <div className="text-[--color-text-muted] text-xs">
                                  Key: {link.campaign_key}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-end gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <select
                                  className={`${inputClass} w-28 text-xs`}
                                  value={
                                    affiliateStatusDrafts[a.id] ||
                                    link?.status ||
                                    "TEST"
                                  }
                                  onChange={(e) =>
                                    setAffiliateStatusDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: e.target
                                        .value as CampaignParticipantStatus,
                                    }))
                                  }
                                >
                                  {participantStatusOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const status =
                                      affiliateStatusDrafts[a.id] ||
                                      link?.status ||
                                      "TEST";
                                    await onUpdateAffiliateStatus(
                                      campaign.id,
                                      a.id,
                                      status,
                                    );
                                  }}
                                >
                                  Update
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  tone={
                                    statusColorMap[link?.status || "TEST"] ||
                                    "neutral"
                                  }
                                >
                                  Campaign: {link?.status || "TEST"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () =>
                                    onRemoveAffiliate(campaign.id, a.id)
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-4">
                  <SectionLabel>Quality Controls</SectionLabel>
                  <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-strong]">
                          Duplicate Check
                        </p>
                        <p className="text-xs text-[--color-text-muted]">
                          Detect duplicates by matching lead payload fields.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={duplicateCheckEnabled}
                        onClick={() =>
                          setDuplicateCheckEnabled((prev) => !prev)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${duplicateCheckEnabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${duplicateCheckEnabled ? "translate-x-5" : "translate-x-1"}`}
                        />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                        Matching Criteria
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {(["phone", "email"] as const).map((criterion) => {
                          const checked =
                            duplicateCheckCriteria.includes(criterion);
                          return (
                            <label
                              key={criterion}
                              className="flex items-center gap-2 text-sm text-[--color-text]"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[--color-primary]"
                                checked={checked}
                                onChange={(e) => {
                                  setDuplicateCheckCriteria((prev) => {
                                    if (e.target.checked) {
                                      return prev.includes(criterion)
                                        ? prev
                                        : [...prev, criterion];
                                    }
                                    return prev.filter(
                                      (item) => item !== criterion,
                                    );
                                  });
                                }}
                              />
                              <span className="capitalize">{criterion}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (
                            duplicateCheckEnabled &&
                            duplicateCheckCriteria.length === 0
                          ) {
                            toast.warning(
                              "Select at least one criterion (phone or email) when duplicate check is enabled.",
                            );
                            return;
                          }
                          await onUpdatePlugins(campaign.id, {
                            duplicate_check: {
                              enabled: duplicateCheckEnabled,
                              criteria: duplicateCheckCriteria,
                            },
                          });
                        }}
                      >
                        Save Quality Controls
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <LinkClientModal
        isOpen={linkClientModalOpen}
        onClose={() => setLinkClientModalOpen(false)}
        clients={availableClients}
        onSubmit={async (clientId) => {
          await onLinkClient(campaign.id, clientId);
          setLinkClientModalOpen(false);
        }}
      />

      <LinkAffiliateModal
        isOpen={linkAffiliateModalOpen}
        onClose={() => setLinkAffiliateModalOpen(false)}
        affiliates={availableAffiliates}
        onSubmit={async (affiliateId) => {
          await onLinkAffiliate(campaign.id, affiliateId);
          setLinkAffiliateModalOpen(false);
        }}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
      {children}
    </p>
  );
}

function InfoItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 text-left ${onClick ? "transition hover:border-[--color-primary]" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <p className="text-sm font-medium text-[--color-text-strong]">
        {value || "—"}
      </p>
    </Wrapper>
  );
}

function ClientModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  return (
    <Modal title="Create Client" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Client> = {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || undefined,
            client_code: form.client_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ops@acme.com"
          />
        </Field>
        <Field label="Phone">
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Client Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.client_code || ""}
              onChange={(e) =>
                setForm({ ...form, client_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() => setForm({ ...form, client_code: generateCode() })}
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function AffiliateModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Affiliate>) => void;
}) {
  const [form, setForm] = useState<Partial<Affiliate>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  return (
    <Modal title="Create Affiliate" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Affiliate> = {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || "",
            affiliate_code: form.affiliate_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Growth Partners"
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="contact@growth.io"
          />
        </Field>
        <Field label="Phone" required>
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Affiliate Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.affiliate_code || ""}
              onChange={(e) =>
                setForm({ ...form, affiliate_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() =>
                setForm({ ...form, affiliate_code: generateCode() })
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialModal({
  isOpen,
  onClose,
  onSubmit,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Credential) => void;
  initial?: Credential | null;
}) {
  const blank: Credential = {
    provider: "",
    type: "api_key",
    credentials: {},
  };
  const [form, setForm] = useState<Credential>(initial ?? blank);

  useEffect(() => {
    setForm(initial ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const setField = <K extends keyof Credential>(key: K, value: Credential[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setCredField = (key: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }));

  return (
    <Modal
      title={initial ? "Edit Credential" : "New Credential"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...form, provider: form.provider.trim() });
        }}
      >
        <Field label="Provider" required>
          <input
            required
            className={inputClass}
            value={form.provider}
            onChange={(e) => setField("provider", e.target.value)}
            placeholder="e.g. salesforce, sendgrid"
            disabled={!!initial}
          />
        </Field>

        <Field label="Type" required>
          <select
            required
            className={inputClass}
            value={form.type}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                type: e.target.value as Credential["type"],
                credentials: {},
              }))
            }
          >
            <option value="api_key">API Key</option>
            <option value="basic_auth">Basic Auth</option>
            <option value="bearer_token">Bearer Token</option>
          </select>
        </Field>

        {form.type === "api_key" && (
          <Field label="API Key" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.apiKey ?? ""}
              onChange={(e) => setCredField("apiKey", e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
          </Field>
        )}

        {form.type === "basic_auth" && (
          <>
            <Field label="Username" required>
              <input
                required
                className={inputClass}
                value={form.credentials.username ?? ""}
                onChange={(e) => setCredField("username", e.target.value)}
                placeholder="username"
                autoComplete="off"
              />
            </Field>
            <Field label="Password" required>
              <input
                required
                type="password"
                className={inputClass}
                value={form.credentials.password ?? ""}
                onChange={(e) => setCredField("password", e.target.value)}
                placeholder="password"
                autoComplete="off"
              />
            </Field>
          </>
        )}

        {form.type === "bearer_token" && (
          <Field label="Token" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.token ?? ""}
              onChange={(e) => setCredField("token", e.target.value)}
              placeholder="Bearer token…"
              autoComplete="off"
            />
          </Field>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{initial ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CampaignModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string }) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Modal title="Create Campaign" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring Promo"
          />
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          Campaigns start as DRAFT. Link a client or affiliate to move to TEST.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

function LinkClientModal({
  isOpen,
  onClose,
  clients,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSubmit: (clientId: string) => void | Promise<void>;
}) {
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setClientId("");
    }
  }, [isOpen]);

  return (
    <Modal title="Add Client to Campaign" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Client" required>
          <select
            className={inputClass}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.client_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!clientId) return;
              onSubmit(clientId);
            }}
            disabled={!clientId}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LinkAffiliateModal({
  isOpen,
  onClose,
  affiliates,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  affiliates: Affiliate[];
  onSubmit: (affiliateId: string) => void | Promise<void>;
}) {
  const [affiliateId, setAffiliateId] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAffiliateId("");
    }
  }, [isOpen]);

  return (
    <Modal title="Add Affiliate to Campaign" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Affiliate" required>
          <select
            className={inputClass}
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
          >
            <option value="">Select affiliate</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.affiliate_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!affiliateId) return;
              onSubmit(affiliateId);
            }}
            disabled={!affiliateId}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PhoneField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="phone-input-wrapper">
      <PhoneInput
        country="us"
        value={(value || "").replace(/^\+/, "")}
        onChange={(val) => {
          const normalized = val.startsWith("+") ? val : `+${val}`;
          onChange(normalized);
        }}
        enableSearch
        inputClass="phone-input-field"
        buttonClass="phone-input-button"
        dropdownClass="phone-input-dropdown"
        inputProps={{ required }}
      />
    </div>
  );
}

function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: "admin" | "staff";
  }) => void;
}) {
  const blank = {
    email: "",
    firstName: "",
    lastName: "",
    role: "staff" as "admin" | "staff",
    password: "",
  };
  const [form, setForm] = useState(blank);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm(blank);
      setShowPass(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleGenerate = () => {
    setForm((prev) => ({ ...prev, password: generatePassword() }));
    setShowPass(true);
  };

  const handleCopy = () => {
    if (!form.password) return;
    navigator.clipboard
      .writeText(form.password)
      .then(() => toast.success("Password copied to clipboard"));
  };

  return (
    <Modal title="Create User" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            email: form.email.trim(),
            password: form.password,
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            role: form.role,
          });
        }}
      >
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
            autoComplete="off"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Jane"
              autoComplete="off"
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Doe"
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label="Role" required>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "staff" })
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Password" required>
          <div className="flex gap-2">
            <input
              required
              type={showPass ? "text" : "password"}
              className={`${inputClass} min-w-0 flex-1`}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 chars"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="shrink-0 px-1 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              title={showPass ? "Hide" : "Show"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleGenerate}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              iconLeft={<Copy size={14} />}
              onClick={handleCopy}
              disabled={!form.password}
            >
              Copy
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create User</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  isOpen,
  onClose,
  onSubmit,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    id: string,
    payload: {
      role?: "admin" | "staff";
      firstName?: string;
      lastName?: string;
    },
  ) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    role: "staff" as "admin" | "staff",
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: user.role,
      });
    }
  }, [user]);

  if (!user) return null;

  return (
    <Modal title="Edit User" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(user.username, {
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            role: form.role,
          });
        }}
      >
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text-muted]">
          {user.email}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Jane"
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Doe"
            />
          </Field>
        </div>
        <Field label="Role">
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "staff" })
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  isOpen,
  onClose,
  onSubmit,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPass(false);
    }
  }, [isOpen]);

  if (!user) return null;

  const handleGenerate = () => {
    const pw = generatePassword();
    setPassword(pw);
    setShowPass(true);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard
      .writeText(password)
      .then(() => toast.success("Password copied to clipboard"));
  };

  return (
    <Modal title="Reset Password" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(user.username, password);
        }}
      >
        <p className="text-sm text-[--color-text-muted]">
          Set a new password for{" "}
          <strong className="text-[--color-text-strong]">{user.email}</strong>
        </p>
        <Field label="New Password" required>
          <div className="flex gap-2">
            <input
              required
              type={showPass ? "text" : "password"}
              className={`${inputClass} min-w-0 flex-1`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="shrink-0 px-1 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              title={showPass ? "Hide" : "Show"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleGenerate}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              iconLeft={<Copy size={14} />}
              onClick={handleCopy}
              disabled={!password}
            >
              Copy
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Reset Password</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteUserModal({
  user,
  isOpen,
  onClose,
  onConfirm,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  if (!user) return null;

  return (
    <Modal title="Delete User" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-[--color-text]">
          Are you sure you want to permanently delete{" "}
          <strong className="text-[--color-text-strong]">{user.email}</strong>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => onConfirm(user.username)}>
            Delete User
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[--color-text-strong]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
