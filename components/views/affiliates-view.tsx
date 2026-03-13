"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { AuditPopover } from "@/components/shared-ui";
import {
  AffiliateModal,
  EditAffiliateModal,
} from "@/components/modals/entity-modals";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import {
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
  listAffiliates,
} from "@/lib/api";
import { formatDate, statusColorMap } from "@/lib/utils";
import type { Affiliate, Campaign } from "@/lib/types";

interface AffiliatesViewProps {
  affiliates: Affiliate[];
  isLoading: boolean;
  onDataChanged: () => void;
  campaigns: Campaign[];
}

export function AffiliatesView({
  affiliates,
  isLoading,
  onDataChanged,
  campaigns,
}: AffiliatesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const showInactive = searchParams?.get("affiliates_inactive") === "true";

  const setAffiliatesParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // When showing deactivated, fetch all records (including deleted) directly.
  // The parent's `affiliates` prop only contains active (non-deleted) records.
  const {
    data: allAffiliatesData,
    isLoading: allAffiliatesLoading,
    mutate: mutateAllAffiliates,
  } = useSWR(showInactive ? "affiliates:include_deleted" : null, async () => {
    const res = await listAffiliates({ includeDeleted: true });
    return (res as any)?.data ?? [];
  });

  const displayedAffiliates: Affiliate[] = showInactive
    ? (allAffiliatesData ?? [])
    : affiliates;
  const displayedLoading = showInactive ? allAffiliatesLoading : isLoading;

  const [affiliateModal, setAffiliateModal] = useState(false);
  const [editAffiliateModal, setEditAffiliateModal] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Affiliate | null>(null);

  const refresh = () => {
    onDataChanged();
    if (showInactive) mutateAllAffiliates();
  };

  const onCreateAffiliate = async (payload: Partial<Affiliate>) => {
    await toast.promise(
      (async () => {
        const res = await createAffiliate(payload);
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.message || "Unable to create affiliate",
          );
        await refresh();
        setAffiliateModal(false);
      })(),
      {
        loading: "Creating affiliate…",
        success: "Affiliate created",
        error: (err) => err?.message || "Unable to create affiliate",
      },
    );
  };

  const onEditAffiliate = async (id: string, payload: Partial<Affiliate>) => {
    await toast.promise(
      (async () => {
        const res = await updateAffiliate(id, payload);
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.message || "Unable to update affiliate",
          );
        await refresh();
        setEditAffiliateModal(false);
        setEditingAffiliate(null);
      })(),
      {
        loading: "Updating affiliate…",
        success: "Affiliate updated",
        error: (err) => err?.message || "Unable to update affiliate",
      },
    );
  };

  const softDeleteDisabledReason = useMemo(() => {
    if (!deleteTarget) return undefined;
    const activeCampaigns = campaigns.filter((c) =>
      c.affiliates?.some(
        (a) => a.affiliate_id === deleteTarget.id && a.status !== "DISABLED",
      ),
    );
    if (activeCampaigns.length === 0) return undefined;
    const names = activeCampaigns.map((c) => `"${c.name}"`).join(", ");
    return `This affiliate is active (TEST or LIVE) in ${names}. Set its status to DISABLED in all campaigns before deactivating.`;
  }, [deleteTarget, campaigns]);

  const hardDeleteDisabledReason = useMemo(() => {
    if (!deleteTarget) return undefined;
    const linked = campaigns.filter((c) =>
      c.affiliates?.some((a) => a.affiliate_id === deleteTarget.id),
    );
    if (linked.length === 0) return undefined;
    const count = linked.length;
    return `This affiliate is still linked to ${count} campaign${count !== 1 ? "s" : ""}. Remove it from all campaigns before permanently deleting.`;
  }, [deleteTarget, campaigns]);

  const onDeleteAffiliate = async (permanent: boolean) => {
    if (!deleteTarget) return;
    await toast.promise(
      (async () => {
        const res = await deleteAffiliate(deleteTarget.id, permanent);
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.error ||
              (res as any)?.message ||
              "Unable to delete affiliate",
          );
        await refresh();
        setDeleteTarget(null);
      })(),
      {
        loading: permanent
          ? "Permanently deleting affiliate…"
          : "Deactivating affiliate…",
        success: permanent
          ? "Affiliate permanently deleted"
          : "Affiliate deactivated",
        error: (err) => err?.message || "Unable to delete affiliate",
      },
    );
  };

  return (
    <motion.section
      key="affiliates"
      className="space-y-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[--color-text-muted]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[--color-primary]"
            checked={showInactive}
            onChange={(e) =>
              setAffiliatesParam(
                "affiliates_inactive",
                e.target.checked ? "true" : undefined,
              )
            }
          />
          Show deactivated
        </label>
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
              <span
                className={`font-medium ${
                  a.deleted_at
                    ? "text-[--color-text-muted] line-through"
                    : "text-[--color-text-strong]"
                }`}
              >
                {a.name}
              </span>
            ),
          },
          { key: "email", label: "Email" },
          {
            key: "phone",
            label: "Phone",
            render: (a) =>
              a.phone
                ? a.phone.replace(
                    /(\+\d{1,3})(\d{3})(\d{3})(\d{4})/,
                    "$1 ($2) $3-$4",
                  )
                : "—",
          },
          { key: "affiliate_code", label: "Code" },
          {
            key: "status",
            label: "Status",
            render: (a) => (
              <Badge tone={statusColorMap[a.status] || "neutral"}>
                {a.status}
              </Badge>
            ),
          },
          {
            key: "created_at",
            label: "Created",
            render: (a) => (
              <div className="flex items-center">
                <span>{formatDate(a.created_at)}</span>
                <AuditPopover
                  createdBy={a.created_by}
                  updatedBy={a.updated_by}
                  updatedAt={a.updated_at}
                  createdAt={a.created_at}
                  entityId={a.id}
                />
              </div>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (a) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingAffiliate(a);
                    setEditAffiliateModal(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setDeleteTarget(a)}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        data={displayedAffiliates}
        emptyLabel={
          displayedLoading
            ? "Loading affiliates…"
            : "No affiliates yet. Add one."
        }
      />

      <AffiliateModal
        isOpen={affiliateModal}
        onClose={() => setAffiliateModal(false)}
        onSubmit={onCreateAffiliate}
      />
      <EditAffiliateModal
        isOpen={editAffiliateModal}
        affiliate={editingAffiliate}
        onClose={() => {
          setEditAffiliateModal(false);
          setEditingAffiliate(null);
        }}
        onSubmit={onEditAffiliate}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteAffiliate}
        entityType="affiliate"
        entityName={deleteTarget?.name || ""}
        canHardDelete
        softDeleteDisabledReason={softDeleteDisabledReason}
        hardDeleteDisabledReason={hardDeleteDisabledReason}
      />
    </motion.section>
  );
}
