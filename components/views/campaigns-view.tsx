"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { AuditPopover } from "@/components/shared-ui";
import { CampaignModal } from "@/components/modals/entity-modals";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import { createCampaign, deleteCampaign } from "@/lib/api";
import { formatDate, statusColorMap } from "@/lib/utils";
import type { Campaign, Lead } from "@/lib/types";
import type { CampaignDetailTab } from "@/lib/types";

// ─── Campaign deletion guards ─────────────────────────────────────────────────

function canDeleteCampaign(campaign: Campaign, leads: Lead[]): boolean {
  const hasLinked =
    (campaign.clients?.length ?? 0) > 0 ||
    (campaign.affiliates?.length ?? 0) > 0;
  const hasLeads = leads.some((l) => l.campaign_id === campaign.id);
  const validStatus = campaign.status === "DRAFT" || campaign.status === "TEST";
  return !hasLinked && !hasLeads && validStatus;
}

function canHardDeleteCampaign(campaign: Campaign): boolean {
  // Hard delete only if campaign has never had participants or received leads
  return !campaign.ever_linked_participants && !campaign.has_received_leads;
}

// ─── CampaignsView ────────────────────────────────────────────────────────────

interface CampaignsViewProps {
  campaigns: Campaign[];
  leads: Lead[];
  isLoading: boolean;
  onDataChanged: () => void;
  onOpenCampaign: (campaignId: string, section?: CampaignDetailTab) => void;
}

export function CampaignsView({
  campaigns,
  leads,
  isLoading,
  onDataChanged,
  onOpenCampaign,
}: CampaignsViewProps) {
  const [campaignModal, setCampaignModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const onCreateCampaign = async (payload: {
    name: string;
    tags?: string[];
  }) => {
    await toast.promise(
      createCampaign(payload).then(() => onDataChanged()),
      {
        loading: "Creating campaign…",
        success: "Campaign created (DRAFT)",
        error: (err) => err?.message || "Unable to create campaign",
      },
    );
    setCampaignModal(false);
  };

  const onDeleteCampaign = async (permanent: boolean) => {
    if (!deleteTarget) return;
    await toast.promise(
      (async () => {
        const res = await deleteCampaign(deleteTarget.id, permanent);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to delete campaign");
        await onDataChanged();
        setDeleteTarget(null);
      })(),
      {
        loading: permanent
          ? "Permanently deleting campaign…"
          : "Deleting campaign…",
        success: permanent
          ? "Campaign permanently deleted"
          : "Campaign deleted",
        error: (err) => err?.message || "Unable to delete campaign",
      },
    );
  };

  return (
    <motion.section
      key="campaigns"
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-center justify-end">
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
            render: (c) => (
              <div className="flex items-center">
                <span>{formatDate(c.created_at)}</span>
                <AuditPopover
                  createdBy={c.created_by}
                  updatedBy={c.updated_by}
                  updatedAt={c.updated_at}
                  createdAt={c.created_at}
                  entityId={c.id}
                />
              </div>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (c) => {
              const deletable = canDeleteCampaign(c, leads);
              return (
                <div className="flex items-center gap-2">
                  {deletable && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                  <ChevronRight
                    size={16}
                    className="text-[--color-text-muted]"
                  />
                </div>
              );
            },
          },
        ]}
        data={campaigns}
        onRowClick={(c) => onOpenCampaign(c.id, "overview")}
        emptyLabel={
          isLoading ? "Loading campaigns…" : "No campaigns yet. Add one."
        }
      />

      <CampaignModal
        isOpen={campaignModal}
        onClose={() => setCampaignModal(false)}
        onSubmit={onCreateCampaign}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteCampaign}
        entityType="campaign"
        entityName={deleteTarget?.name || ""}
        canHardDelete={
          deleteTarget ? canHardDeleteCampaign(deleteTarget) : false
        }
      />
    </motion.section>
  );
}
