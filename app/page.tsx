"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { LogOut, RefreshCcw } from "lucide-react";

import { Sidebar, type NavKey } from "@/components/sidebar";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInScreen } from "@/components/sign-in-screen";

import { HomeView } from "@/components/views/home-view";
import {
  LeadsView,
  type LeadSortKey,
  type LeadViewFilters,
} from "@/components/views/leads-view";
import { ClientsView } from "@/components/views/clients-view";
import { AffiliatesView } from "@/components/views/affiliates-view";
import { CampaignsView } from "@/components/views/campaigns-view";
import { AdminView } from "@/components/views/admin-view";
import { ToolsView } from "@/components/views/tools-view";
import { PayloadPreview } from "@/components/payload-preview";
import { CampaignDetailModal } from "@/components/campaign-detail-modal";
import { ClientDetailModal } from "@/components/modals/entity-modals";

import {
  listLeads,
  listClients,
  listAffiliates,
  listCampaigns,
  linkClientToCampaign,
  linkAffiliateToCampaign,
  removeClientFromCampaign,
  removeAffiliateFromCampaign,
  rotateAffiliateKey,
  updateCampaign,
  updateCampaignStatus,
  updateCampaignClientStatus,
  updateCampaignAffiliateStatus,
  updateCampaignPlugins,
  setCampaignAffiliateLeadCap,
  setCampaignClientDeliveryConfig,
  setCampaignDistributionConfig,
  setClientWeight,
} from "@/lib/api";
import type { Affiliate, Campaign, Client, Lead } from "@/lib/types";
import type {
  CampaignDetailTab,
  CampaignParticipantStatus,
  ClientDeliveryConfig,
  DistributionMode,
} from "@/lib/types";
import {
  login,
  getCurrentUser,
  getIdTokenSync,
  readSession,
  signOut,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

// ─── Auth display helpers ─────────────────────────────────────────────────────

/** "Jane Doe" → "JD"; "Jane" → "JA"; no names → first two chars of email */
const userInitials = (u: AuthUser): string => {
  if (u.firstName && u.lastName)
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  if (u.firstName) return u.firstName.slice(0, 2).toUpperCase();
  const prefix = u.email.split("@")[0] ?? u.email;
  return prefix.slice(0, 2).toUpperCase();
};

/** "Jane Doe" or "Jane" or "jane" (email prefix) */
const userDisplayName = (u: AuthUser): string => {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  if (name) return name;
  return u.email.split("@")[0] ?? u.email;
};

// ─── Dashboard (auth shell) ───────────────────────────────────────────────────
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

  // Immediately sign out if the session is invalidated by a 401 / forced sign-out
  // (e.g. another admin disables this user's Cognito account — the refresh token
  // is revoked immediately, so the next refresh attempt will fail and dispatch
  // this event via forceSignOut() in lib/auth.ts).
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const handler = () => handleSignOut();
    window.addEventListener("lms:session-invalidated", handler);
    return () => window.removeEventListener("lms:session-invalidated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  // Re-check session when the user returns to this tab. Covers the case where
  // the session was cleared (by another tab or by the event above) while the
  // tab was in the background.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !getCurrentUser()) {
        handleSignOut();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

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
      tools: "Tools",
      admin: "Admin",
    };
    document.title = `LMS | ${labels[active] ?? active}`;
  }, [active]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null,
  );
  const [campaignDetailTab, setCampaignDetailTab] =
    useState<CampaignDetailTab>("overview");
  const [campaignDetailSubTab, setCampaignDetailSubTab] = useState<
    "base-criteria" | "logic" | "routing" | undefined
  >(undefined);
  const [focusedAffiliateId, setFocusedAffiliateId] = useState<string | null>(
    null,
  );

  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false);
  const [quickViewClientId, setQuickViewClientId] = useState<string | null>(
    null,
  );
  const closeCampaignResetTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    return () => {
      if (closeCampaignResetTimeoutRef.current) {
        clearTimeout(closeCampaignResetTimeoutRef.current);
      }
    };
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

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
  } = useSWR<Lead[]>(
    "leads",
    async () => {
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
    },
    {
      // Poll every 15 s so new leads from DynamoDB appear without a manual refresh.
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    },
  );

  // Notify when new leads arrive after the initial load.
  const knownLeadIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (leadsLoading) return;
    const currentIds = new Set(leads.map((l) => l.id));
    if (knownLeadIdsRef.current === null) {
      // First successful load — just store the IDs, no toast.
      knownLeadIdsRef.current = currentIds;
      return;
    }
    const newLeads = leads.filter((l) => !knownLeadIdsRef.current!.has(l.id));
    if (newLeads.length > 0) {
      if (newLeads.length === 1) {
        const leadId = newLeads[0].id;
        const openSingleLead = () => {
          setCampaignDetailOpen(false);
          setSelectedCampaign(null);
          setFocusedAffiliateId(null);
          setCampaignDetailTab("overview");
          setCampaignDetailSubTab(undefined);
          const nextParams = {
            view: "leads",
            lead: leadId,
            leadTab: "summary",
            leadQc: undefined,
            leadPt: undefined,
            campaign: undefined,
            section: undefined,
            subsection: undefined,
            affiliate: undefined,
          };
          if (active !== "leads") {
            setActive("leads");
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setQueryParams(nextParams));
            });
          } else {
            setQueryParams(nextParams);
          }
        };

        toast.success(`1 new lead received: ${leadId}`, {
          id: `new-lead-${leadId}`,
          action: {
            label: "Open",
            onClick: openSingleLead,
          },
        });
      } else {
        const openLeadsList = () => {
          setCampaignDetailOpen(false);
          setSelectedCampaign(null);
          setFocusedAffiliateId(null);
          setCampaignDetailTab("overview");
          setCampaignDetailSubTab(undefined);
          setActive("leads");
          setQueryParams({
            view: "leads",
            lead: undefined,
            leadTab: undefined,
            leadQc: undefined,
            leadPt: undefined,
            campaign: undefined,
            section: undefined,
            subsection: undefined,
            affiliate: undefined,
          });
        };

        toast.success(`${newLeads.length} new leads received`, {
          id: "new-leads",
          action: {
            label: "View",
            onClick: openLeadsList,
          },
        });
      }
    }
    knownLeadIdsRef.current = currentIds;
  }, [leads, leadsLoading, active]);

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
      return right - left;
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

  const role = currentUser?.role;

  const leadFiltersFromQuery = useMemo<LeadViewFilters>(() => {
    const sort = (searchParams?.get("lead_sort") ??
      "created_at") as LeadSortKey;
    const validSort: LeadSortKey[] = [
      "created_at",
      "campaign",
      "affiliate",
      "mode",
      "status",
      "duplicate",
      "trusted_form",
      "ipqs",
      "id",
    ];
    const sortsRaw = searchParams?.get("lead_sorts") ?? "";
    const parsedSorts = sortsRaw
      .split(",")
      .map((segment) => {
        const [key, dir] = segment.split(":");
        if (!validSort.includes(key as LeadSortKey)) return null;
        if (dir !== "asc" && dir !== "desc") return null;
        return { key: key as LeadSortKey, dir: dir as "asc" | "desc" };
      })
      .filter((v): v is { key: LeadSortKey; dir: "asc" | "desc" } => !!v);

    const fallbackPrimary = {
      key: validSort.includes(sort) ? sort : "created_at",
      dir:
        searchParams?.get("lead_dir") === "asc"
          ? ("asc" as const)
          : ("desc" as const),
    };

    return {
      search: searchParams?.get("lead_search") ?? "",
      campaignId: searchParams?.get("lead_campaign") ?? "all",
      affiliateId: searchParams?.get("lead_affiliate") ?? "all",
      mode:
        (searchParams?.get("lead_mode") as LeadViewFilters["mode"]) || "all",
      status:
        (searchParams?.get("lead_status") as LeadViewFilters["status"]) ||
        "all",
      sortBy: fallbackPrimary.key,
      sortDir: fallbackPrimary.dir,
      sorts: parsedSorts.length > 0 ? parsedSorts : [fallbackPrimary],
    };
  }, [searchParams]);

  // Effect 1: Sync active view from URL (does NOT depend on campaigns so that
  // SWR refreshes of campaign data don't re-trigger navigation logic).
  useEffect(() => {
    const viewParam = searchParams?.get("view");
    // Support legacy "settings" URL param — redirect to admin
    const resolvedView = viewParam === "settings" ? "admin" : viewParam;
    if (
      resolvedView &&
      [
        "home",
        "leads",
        "clients",
        "affiliates",
        "campaigns",
        "admin",
        "tools",
      ].includes(resolvedView)
    ) {
      // Non-admins trying to deep-link to admin get bounced to home
      if (resolvedView === "admin" && role !== "admin") {
        setActive("home");
        setQueryParams({ view: "home" });
        toast.error("Page not found.", { id: "admin-blocked" });
      } else {
        setActive(resolvedView as NavKey);
      }
    }
  }, [searchParams, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: Open campaign detail modal from URL params. Depends on campaigns
  // so the modal opens once campaign data is available after a deep-link load.
  useEffect(() => {
    const campaignParam = searchParams?.get("campaign");
    if (!campaignParam || campaigns.length === 0) return;
    const found = campaigns.find((c) => c.id === campaignParam);
    if (found) {
      // If the modal is already open for this campaign, only refresh the
      // campaign data — don't reset the tab/subTab from the URL, because the
      // tab is already being managed by onTabChange directly.  Without this
      // guard, an SWR campaign refresh that fires before router.replace
      // completes reads stale searchParams and resets the active tab.
      const alreadyOpen =
        campaignDetailOpen && selectedCampaign?.id === campaignParam;
      setSelectedCampaign(found);
      setCampaignDetailOpen(true);
      if (!alreadyOpen) {
        const sectionParam = searchParams?.get("section");
        const nextTab: CampaignDetailTab =
          sectionParam === "clients" ||
          sectionParam === "affiliates" ||
          sectionParam === "integrations" ||
          sectionParam === "settings" ||
          sectionParam === "history"
            ? (sectionParam as CampaignDetailTab)
            : "overview";
        setCampaignDetailTab(nextTab);
        const subsectionParam = searchParams?.get("subsection");
        setCampaignDetailSubTab(
          subsectionParam === "logic"
            ? "logic"
            : subsectionParam === "routing"
              ? "routing"
              : subsectionParam === "criteria"
                ? "base-criteria"
                : undefined,
        );
        setFocusedAffiliateId(searchParams?.get("affiliate") || null);
      }
    }
  }, [campaigns, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCampaignsAndSelect = async (campaignId?: string) => {
    const data = await refreshCampaigns();
    if (campaignId && Array.isArray(data)) {
      const updated = data.find((c) => c.id === campaignId);
      if (updated) setSelectedCampaign(updated);
    }
  };

  const title = useMemo(() => {
    const map: Record<NavKey, string> = {
      home: "Home",
      leads: "Leads",
      clients: "Clients",
      affiliates: "Affiliates",
      campaigns: "Campaigns",
      tools: "Tools",
      admin: "Admin",
    };
    return map[active] ?? active;
  }, [active]);

  const description = useMemo(() => {
    switch (active) {
      case "home":
        return "Lead Management System (PENDING NAME)";
      case "clients":
        return "Manage clients, their details, and status";
      case "affiliates":
        return "Manage affiliates, their details, and status";
      case "campaigns":
        return "Create, configure, link clients/affiliates, and manage campaign settings";
      case "admin":
        return "View and manage system settings, credentials, users, and logs";
      case "tools":
        return "Access various tools and utilities";
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
    setCampaignDetailSubTab(undefined);
    setQueryParams({
      view: next,
      campaign: undefined,
      section: undefined,
      subsection: undefined,
      affiliate: undefined,
      leadTab: undefined,
      leadQc: undefined,
      leadPt: undefined,
      lead_search: undefined,
      lead_campaign: undefined,
      lead_affiliate: undefined,
      lead_mode: undefined,
      lead_status: undefined,
      lead_sort: undefined,
      lead_dir: undefined,
      lead_sorts: undefined,
      settings_section: undefined,
      admin_tab: undefined,
      logs_section: undefined,
      logs_entity: undefined,
      logs_actor: undefined,
      logs_sort: undefined,
      clients_inactive: undefined,
      affiliates_inactive: undefined,
    });
  };

  const handleRefresh = () => {
    if (active === "leads") refreshLeads();
    if (active === "clients") refreshClients();
    if (active === "affiliates") refreshAffiliates();
    if (active === "campaigns") refreshCampaigns();
    // settings: SettingsView owns its own SWR and refresh
  };

  const openCampaign = (
    campaignId: string,
    section: CampaignDetailTab = "overview",
    affiliateId?: string,
    subSection?: "base-criteria" | "logic",
  ) => {
    if (closeCampaignResetTimeoutRef.current) {
      clearTimeout(closeCampaignResetTimeoutRef.current);
      closeCampaignResetTimeoutRef.current = null;
    }

    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      toast.error("Campaign not found");
      return;
    }
    setSelectedCampaign(campaign);
    setCampaignDetailTab(section);
    setCampaignDetailSubTab(
      subSection === "logic"
        ? "logic"
        : subSection === "base-criteria"
          ? "base-criteria"
          : undefined,
    );
    setFocusedAffiliateId(
      section === "affiliates" ? affiliateId || null : null,
    );
    const nextParams = {
      view: "campaigns",
      campaign: campaignId,
      section,
      subsection:
        subSection === "logic"
          ? "logic"
          : subSection === "base-criteria"
            ? "criteria"
            : undefined,
      affiliate: section === "affiliates" ? affiliateId : undefined,
    };

    const openAfterTransition = () => {
      setCampaignDetailOpen(true);
      setQueryParams(nextParams);
    };

    if (active !== "campaigns") {
      setActive("campaigns");
      requestAnimationFrame(() => {
        requestAnimationFrame(openAfterTransition);
      });
    } else {
      openAfterTransition();
    }
  };

  const openLead = (leadId: string) => {
    setCampaignDetailOpen(false);
    setSelectedCampaign(null);
    setFocusedAffiliateId(null);
    setCampaignDetailTab("overview");
    setCampaignDetailSubTab(undefined);
    const nextParams = {
      view: "leads",
      lead: leadId,
      leadTab: "summary",
      leadQc: undefined,
      leadPt: undefined,
      campaign: undefined,
      section: undefined,
      subsection: undefined,
      affiliate: undefined,
    };

    if (active !== "leads") {
      setActive("leads");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setQueryParams(nextParams));
      });
    } else {
      setQueryParams(nextParams);
    }
  };

  const onLeadFiltersChange = (filters: LeadViewFilters) => {
    const primarySort = filters.sorts?.[0] ?? {
      key: filters.sortBy,
      dir: filters.sortDir,
    };
    const normalizedSorts =
      filters.sorts && filters.sorts.length > 0 ? filters.sorts : [primarySort];

    setQueryParams({
      lead_search: filters.search || undefined,
      lead_campaign:
        filters.campaignId !== "all" ? filters.campaignId : undefined,
      lead_affiliate:
        filters.affiliateId !== "all" ? filters.affiliateId : undefined,
      lead_mode: filters.mode !== "all" ? filters.mode : undefined,
      lead_status: filters.status !== "all" ? filters.status : undefined,
      lead_sort: primarySort.key !== "created_at" ? primarySort.key : undefined,
      lead_dir: primarySort.dir !== "desc" ? primarySort.dir : undefined,
      lead_sorts:
        normalizedSorts.length > 1 ||
        normalizedSorts[0].key !== "created_at" ||
        normalizedSorts[0].dir !== "desc"
          ? normalizedSorts.map((s) => `${s.key}:${s.dir}`).join(",")
          : undefined,
    });
  };

  const openLeadsForCampaign = (
    campaignId: string,
    options?: { affiliateId?: string; mode?: "all" | "test" | "live" },
  ) => {
    setCampaignDetailOpen(false);
    setSelectedCampaign(null);
    setFocusedAffiliateId(null);
    setCampaignDetailTab("overview");
    setCampaignDetailSubTab(undefined);
    setActive("leads");
    setQueryParams({
      view: "leads",
      lead_campaign: campaignId,
      lead_search: undefined,
      lead_affiliate:
        options?.affiliateId && options.affiliateId !== "all"
          ? options.affiliateId
          : undefined,
      lead_mode:
        options?.mode && options.mode !== "all" ? options.mode : undefined,
      lead_status: undefined,
      lead_sort: undefined,
      lead_dir: undefined,
      lead_sorts: undefined,
      campaign: undefined,
      section: undefined,
      subsection: undefined,
      affiliate: undefined,
    });
  };

  const closeCampaignDetail = () => {
    setCampaignDetailOpen(false);

    if (closeCampaignResetTimeoutRef.current) {
      clearTimeout(closeCampaignResetTimeoutRef.current);
    }
    closeCampaignResetTimeoutRef.current = setTimeout(() => {
      setSelectedCampaign(null);
      closeCampaignResetTimeoutRef.current = null;
    }, 220);

    setFocusedAffiliateId(null);
    setCampaignDetailTab("overview");
    setCampaignDetailSubTab(undefined);
    setQueryParams({
      campaign: undefined,
      section: undefined,
      subsection: undefined,
      affiliate: undefined,
      view: active !== "leads" ? active : undefined,
    });
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

  const onEditCampaignName = async (campaignId: string, name: string) => {
    const promise = updateCampaign(campaignId, { name }).then(() =>
      refreshCampaignsAndSelect(campaignId),
    );
    await toast.promise(promise, {
      loading: "Updating name…",
      success: "Campaign name updated",
      error: (err) => err?.message || "Unable to update name",
    });
  };

  const onRotateCampaignParticipantKey = async (
    campaignId: string,
    type: "client" | "affiliate",
    participantId: string,
  ) => {
    if (type !== "affiliate") return;
    const promise = rotateAffiliateKey(campaignId, participantId).then(
      (res) => {
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.error || res?.message || "Unable to rotate key",
          );
        return refreshCampaignsAndSelect(campaignId);
      },
    );
    await toast.promise(promise, {
      loading: "Rotating campaign key…",
      success: "Campaign key rotated",
      error: (err) => err?.message || "Unable to rotate key",
    });
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
    payload: Parameters<typeof updateCampaignPlugins>[1],
  ) => {
    const promise = updateCampaignPlugins(campaignId, payload);
    await toast.promise(promise, {
      loading: "Updating quality controls…",
      success: "Quality controls updated",
      error: (err) => err?.message || "Unable to update quality controls",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateAffiliateLeadCap = async (
    campaignId: string,
    affiliateId: string,
    leadCap: number | null,
  ) => {
    const promise = setCampaignAffiliateLeadCap(
      campaignId,
      affiliateId,
      leadCap,
    );
    await toast.promise(promise, {
      loading: "Updating lead cap…",
      success: leadCap == null ? "Lead cap removed" : "Lead cap updated",
      error: (err) => err?.message || "Unable to update lead cap",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateClientDeliveryConfig = async (
    campaignId: string,
    clientId: string,
    payload: ClientDeliveryConfig,
  ) => {
    const promise = setCampaignClientDeliveryConfig(
      campaignId,
      clientId,
      payload,
    );
    await toast.promise(promise, {
      loading: "Saving delivery config…",
      success: "Delivery config updated",
      error: (err) => err?.message || "Unable to update delivery config",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateCampaignDistribution = async (
    campaignId: string,
    payload: {
      mode: DistributionMode;
      enabled: boolean;
    },
  ) => {
    const promise = setCampaignDistributionConfig(campaignId, payload);
    await toast.promise(promise, {
      loading: "Saving routing config…",
      success: "Routing config updated",
      error: (err) => err?.message || "Unable to update routing config",
    });
    await refreshCampaignsAndSelect(campaignId);
  };

  const onUpdateCampaignClientWeight = async (
    campaignId: string,
    clientId: string,
    deliveryConfig: ClientDeliveryConfig,
    weight: number,
  ) => {
    await setClientWeight(campaignId, clientId, deliveryConfig, weight);
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <HomeView />
            </motion.section>
          )}
          {active === "leads" && (
            <motion.section
              key="leads"
              className="space-y-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <LeadsView
                leads={sortedLeads}
                campaigns={campaigns}
                affiliates={affiliates}
                isLoading={leadsLoading}
                onOpenCampaign={openCampaign}
                initialFilters={leadFiltersFromQuery}
                onFiltersChange={onLeadFiltersChange}
                renderPayloadPreview={(lead, allLeads) => (
                  <PayloadPreview
                    lead={lead}
                    allLeads={allLeads}
                    campaignPlugins={
                      campaigns.find((c) => c.id === lead.campaign_id)?.plugins
                    }
                    clients={clients}
                    onOpenClient={(clientId) => setQuickViewClientId(clientId)}
                  />
                )}
              />
            </motion.section>
          )}

          {active === "clients" && (
            <motion.section
              key="clients"
              className="space-y-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <ClientsView
                clients={clients}
                isLoading={clientsLoading}
                onDataChanged={refreshClients}
                campaigns={campaigns}
              />
            </motion.section>
          )}

          {active === "affiliates" && (
            <motion.section
              key="affiliates"
              className="space-y-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <AffiliatesView
                affiliates={affiliates}
                isLoading={affiliatesLoading}
                onDataChanged={refreshAffiliates}
                campaigns={campaigns}
              />
            </motion.section>
          )}

          {active === "campaigns" && (
            <motion.section
              key="campaigns"
              className="space-y-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <CampaignsView
                campaigns={campaigns}
                leads={leads}
                isLoading={campaignsLoading}
                onDataChanged={refreshCampaigns}
                onOpenCampaign={openCampaign}
              />
            </motion.section>
          )}

          {active === "tools" && <ToolsView />}

          {active === "admin" && role !== "admin" ? (
            <motion.section
              key="not-found"
              className="flex flex-col items-center justify-center py-32 gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
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
            active === "admin" && (
              <motion.section
                key="admin"
                className="space-y-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
              >
                <AdminView
                  role={role}
                  onOpenCampaign={openCampaign}
                  onOpenLead={openLead}
                />
              </motion.section>
            )
          )}
        </AnimatePresence>
      </main>

      <CampaignDetailModal
        campaign={selectedCampaign}
        clients={clients}
        affiliates={affiliates}
        leads={leads}
        isOpen={campaignDetailOpen}
        onClose={closeCampaignDetail}
        onStatusChange={onUpdateCampaignStatus}
        onLinkClient={onLinkClientToCampaign}
        onLinkAffiliate={onLinkAffiliateToCampaign}
        onUpdateClientStatus={onUpdateClientLinkStatus}
        onUpdateAffiliateStatus={onUpdateAffiliateLinkStatus}
        onRemoveClient={onRemoveClientFromCampaign}
        onRemoveAffiliate={onRemoveAffiliateFromCampaign}
        onUpdatePlugins={onUpdateCampaignPlugins}
        onTabChange={(tab, subTab) => {
          setCampaignDetailTab(tab);
          setCampaignDetailSubTab(subTab);
          if (tab !== "affiliates") setFocusedAffiliateId(null);
          setQueryParams({
            view: "campaigns",
            campaign: selectedCampaign?.id,
            section: tab,
            subsection:
              subTab === "logic"
                ? "logic"
                : subTab === "routing"
                  ? "routing"
                  : subTab === "base-criteria"
                    ? "criteria"
                    : undefined,
            affiliate:
              tab === "affiliates"
                ? focusedAffiliateId || undefined
                : undefined,
          });
        }}
        subTab={campaignDetailSubTab}
        onSubTabChange={(sub) => {
          setCampaignDetailSubTab(sub);
          setQueryParams({
            subsection:
              sub === "logic"
                ? "logic"
                : sub === "routing"
                  ? "routing"
                  : "criteria",
          });
        }}
        onOpenLeadsForCampaign={openLeadsForCampaign}
        focusAffiliateId={focusedAffiliateId}
        tab={campaignDetailTab}
        onUpdateName={onEditCampaignName}
        onRotateParticipantKey={onRotateCampaignParticipantKey}
        onUpdateAffiliateLeadCap={onUpdateAffiliateLeadCap}
        onUpdateClientDeliveryConfig={onUpdateClientDeliveryConfig}
        onUpdateCampaignDistribution={onUpdateCampaignDistribution}
        onUpdateClientWeight={onUpdateCampaignClientWeight}
      />
      <ClientDetailModal
        client={clients.find((c) => c.id === quickViewClientId) ?? null}
        isOpen={!!quickViewClientId}
        onClose={() => setQuickViewClientId(null)}
      />
    </div>
  );
}
