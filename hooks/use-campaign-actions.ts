"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
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
  setCampaignAffiliateSoldPixelConfig,
  setCampaignClientDeliveryConfig,
  setCampaignDistributionConfig,
  setClientWeight,
} from "@/lib/api";
import type {
  AffiliateSoldPixelConfig,
  Campaign,
  CampaignParticipantStatus,
  ClientDeliveryConfig,
  DistributionMode,
} from "@/lib/types";

interface UseCampaignActionsOptions {
  refreshCampaignsAndSelect: (campaignId?: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setActive: (view: any) => void;
}

export function useCampaignActions({
  refreshCampaignsAndSelect,
  setActive,
}: UseCampaignActionsOptions) {
  const onLinkClientToCampaign = useCallback(
    async (campaignId: string, clientId: string) => {
      const promise = linkClientToCampaign(campaignId, clientId);
      toast.promise(promise, {
        loading: "Linking client…",
        success: "Client linked",
        error: (err) => err?.message || "Unable to link client",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
      setActive("campaigns");
    },
    [refreshCampaignsAndSelect, setActive],
  );

  const onLinkAffiliateToCampaign = useCallback(
    async (campaignId: string, affiliateId: string) => {
      const promise = linkAffiliateToCampaign(campaignId, affiliateId);
      toast.promise(promise, {
        loading: "Linking source…",
        success: "Source linked (campaign key refreshed)",
        error: (err) => err?.message || "Unable to link source",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
      setActive("campaigns");
    },
    [refreshCampaignsAndSelect, setActive],
  );

  const onUpdateClientLinkStatus = useCallback(
    async (
      campaignId: string,
      clientId: string,
      status: CampaignParticipantStatus,
    ) => {
      const promise = updateCampaignClientStatus(campaignId, clientId, status);
      toast.promise(promise, {
        loading: "Updating client status…",
        success: "Client status updated",
        error: (err) => err?.message || "Unable to update client status",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateAffiliateLinkStatus = useCallback(
    async (
      campaignId: string,
      affiliateId: string,
      status: CampaignParticipantStatus,
    ) => {
      const promise = updateCampaignAffiliateStatus(
        campaignId,
        affiliateId,
        status,
      );
      toast.promise(promise, {
        loading: "Updating source status…",
        success: "Source status updated",
        error: (err) => err?.message || "Unable to update source status",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onRemoveClientFromCampaign = useCallback(
    async (campaignId: string, clientId: string) => {
      const promise = removeClientFromCampaign(campaignId, clientId);
      toast.promise(promise, {
        loading: "Removing client…",
        success: "Client removed from campaign",
        error: (err) => err?.message || "Unable to remove client",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onRemoveAffiliateFromCampaign = useCallback(
    async (campaignId: string, affiliateId: string) => {
      const promise = removeAffiliateFromCampaign(campaignId, affiliateId);
      toast.promise(promise, {
        loading: "Removing source…",
        success: "Source removed from campaign",
        error: (err) => err?.message || "Unable to remove source",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onEditCampaignName = useCallback(
    async (campaignId: string, name: string) => {
      const promise = updateCampaign(campaignId, { name }).then(() =>
        refreshCampaignsAndSelect(campaignId),
      );
      await toast.promise(promise, {
        loading: "Updating name…",
        success: "Campaign name updated",
        error: (err) => err?.message || "Unable to update name",
      });
    },
    [refreshCampaignsAndSelect],
  );

  const onRotateCampaignParticipantKey = useCallback(
    async (
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
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateCampaignStatus = useCallback(
    async (id: string, status: Campaign["status"]) => {
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
            "Unable to update status. Add a client or source first.",
          { id: toastId },
        );
        return false;
      }
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateCampaignPlugins = useCallback(
    async (
      campaignId: string,
      payload: Parameters<typeof updateCampaignPlugins>[1],
    ) => {
      const promise = updateCampaignPlugins(campaignId, payload);
      toast.promise(promise, {
        loading: "Updating quality controls…",
        success: "Quality controls updated",
        error: (err) => err?.message || "Unable to update quality controls",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateAffiliateLeadCap = useCallback(
    async (campaignId: string, affiliateId: string, leadCap: number | null) => {
      const promise = setCampaignAffiliateLeadCap(
        campaignId,
        affiliateId,
        leadCap,
      );
      toast.promise(promise, {
        loading: "Updating lead cap…",
        success: leadCap == null ? "Lead cap removed" : "Lead cap updated",
        error: (err) => err?.message || "Unable to update lead cap",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateClientDeliveryConfig = useCallback(
    async (
      campaignId: string,
      clientId: string,
      payload: ClientDeliveryConfig,
    ) => {
      const promise = setCampaignClientDeliveryConfig(
        campaignId,
        clientId,
        payload,
      );
      toast.promise(promise, {
        loading: "Saving delivery config…",
        success: "Delivery config updated",
        error: (err) => err?.message || "Unable to update delivery config",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateAffiliateSoldPixelConfig = useCallback(
    async (
      campaignId: string,
      affiliateId: string,
      payload: AffiliateSoldPixelConfig,
    ) => {
      const promise = setCampaignAffiliateSoldPixelConfig(
        campaignId,
        affiliateId,
        payload,
      );
      toast.promise(promise, {
        loading: "Saving sold webhook config\u2026",
        success: payload.enabled
          ? "Source sold webhook enabled"
          : "Source sold webhook config saved",
        error: (err) => err?.message || "Unable to update sold webhook config",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateCampaignDistribution = useCallback(
    async (
      campaignId: string,
      payload: { mode: DistributionMode; enabled: boolean },
    ) => {
      const promise = setCampaignDistributionConfig(campaignId, payload);
      toast.promise(promise, {
        loading: "Saving routing config…",
        success: "Routing config updated",
        error: (err) => err?.message || "Unable to update routing config",
      });
      try {
        await promise;
      } catch {
        return;
      }
      await refreshCampaignsAndSelect(campaignId);
    },
    [refreshCampaignsAndSelect],
  );

  const onUpdateCampaignClientWeight = useCallback(
    async (
      campaignId: string,
      clientId: string,
      deliveryConfig: ClientDeliveryConfig,
      weight: number,
    ) => {
      await setClientWeight(campaignId, clientId, deliveryConfig, weight);
    },
    [],
  );

  return {
    onLinkClientToCampaign,
    onLinkAffiliateToCampaign,
    onUpdateClientLinkStatus,
    onUpdateAffiliateLinkStatus,
    onRemoveClientFromCampaign,
    onRemoveAffiliateFromCampaign,
    onEditCampaignName,
    onRotateCampaignParticipantKey,
    onUpdateCampaignStatus,
    onUpdateCampaignPlugins,
    onUpdateAffiliateLeadCap,
    onUpdateClientDeliveryConfig,
    onUpdateAffiliateSoldPixelConfig,
    onUpdateCampaignDistribution,
    onUpdateCampaignClientWeight,
  };
}
