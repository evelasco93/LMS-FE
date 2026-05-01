import { Dispatch, SetStateAction, useEffect, useRef } from "react";

type NestedModalState = {
  window?: string;
  window_id?: string;
  window_tab?: string;
};

type UseNestedModalSyncParams = {
  isOpen: boolean;
  onNestedModalChange?: (modal: NestedModalState) => void;
  pixelAffiliateId: string | null;
  pixelConfigTab: "pixel_criteria" | "sold_criteria" | "pixel";
  deliveryClientId: string | null;
  affiliateCapModalId: string | null;
  linkClientModalOpen: boolean;
  linkAffiliateModalOpen: boolean;
  catalogOpen: boolean;
  logicCatalogOpen: boolean;
  logicBuilderOpen: boolean;
  addFieldOpen: boolean;
  initialModal?: NestedModalState;
  hasCampaign: boolean;
  setPixelAffiliateId: Dispatch<SetStateAction<string | null>>;
  setPixelConfigTab: Dispatch<
    SetStateAction<"pixel_criteria" | "sold_criteria" | "pixel">
  >;
  setDeliveryClientId: Dispatch<SetStateAction<string | null>>;
  setAffiliateCapModalId: Dispatch<SetStateAction<string | null>>;
  setLinkClientModalOpen: Dispatch<SetStateAction<boolean>>;
  setLinkAffiliateModalOpen: Dispatch<SetStateAction<boolean>>;
  setCatalogOpen: Dispatch<SetStateAction<boolean>>;
  setLogicCatalogOpen: Dispatch<SetStateAction<boolean>>;
  setLogicBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setAddFieldOpen: Dispatch<SetStateAction<boolean>>;
};

export function useNestedModalSync({
  isOpen,
  onNestedModalChange,
  pixelAffiliateId,
  pixelConfigTab,
  deliveryClientId,
  affiliateCapModalId,
  linkClientModalOpen,
  linkAffiliateModalOpen,
  catalogOpen,
  logicCatalogOpen,
  logicBuilderOpen,
  addFieldOpen,
  initialModal,
  hasCampaign,
  setPixelAffiliateId,
  setPixelConfigTab,
  setDeliveryClientId,
  setAffiliateCapModalId,
  setLinkClientModalOpen,
  setLinkAffiliateModalOpen,
  setCatalogOpen,
  setLogicCatalogOpen,
  setLogicBuilderOpen,
  setAddFieldOpen,
}: UseNestedModalSyncParams) {
  useEffect(() => {
    if (!onNestedModalChange || !isOpen) return;

    let nestedWindow: string | undefined;
    let window_id: string | undefined;
    let window_tab: string | undefined;

    if (pixelAffiliateId) {
      nestedWindow = "fire-pixel";
      window_id = pixelAffiliateId;
      window_tab = pixelConfigTab;
    } else if (deliveryClientId) {
      nestedWindow = "delivery";
      window_id = deliveryClientId;
    } else if (affiliateCapModalId) {
      nestedWindow = "lead-cap";
      window_id = affiliateCapModalId;
    } else if (linkClientModalOpen) {
      nestedWindow = "link-client";
    } else if (linkAffiliateModalOpen) {
      nestedWindow = "link-affiliate";
    } else if (catalogOpen) {
      nestedWindow = "criteria-catalog";
    } else if (logicCatalogOpen) {
      nestedWindow = "logic-catalog";
    } else if (logicBuilderOpen) {
      nestedWindow = "logic-builder";
    } else if (addFieldOpen) {
      nestedWindow = "add-field";
    }

    onNestedModalChange({ window: nestedWindow, window_id, window_tab });
  }, [
    isOpen,
    pixelAffiliateId,
    pixelConfigTab,
    deliveryClientId,
    affiliateCapModalId,
    linkClientModalOpen,
    linkAffiliateModalOpen,
    catalogOpen,
    logicCatalogOpen,
    logicBuilderOpen,
    addFieldOpen,
    onNestedModalChange,
  ]);

  const initialModalAppliedRef = useRef(false);
  useEffect(() => {
    if (
      !initialModal?.window ||
      !isOpen ||
      !hasCampaign ||
      initialModalAppliedRef.current
    )
      return;
    initialModalAppliedRef.current = true;

    const {
      window: modalWindow,
      window_id: id,
      window_tab: modalTab,
    } = initialModal;
    switch (modalWindow) {
      case "fire-pixel":
        if (id) {
          setPixelAffiliateId(id);
          if (modalTab === "pixel_criteria" || modalTab === "sold_criteria") {
            setPixelConfigTab(modalTab);
          }
        }
        break;
      case "delivery":
        if (id) setDeliveryClientId(id);
        break;
      case "lead-cap":
        if (id) setAffiliateCapModalId(id);
        break;
      case "link-client":
        setLinkClientModalOpen(true);
        break;
      case "link-affiliate":
        setLinkAffiliateModalOpen(true);
        break;
      case "criteria-catalog":
        setCatalogOpen(true);
        break;
      case "logic-catalog":
        setLogicCatalogOpen(true);
        break;
      case "logic-builder":
        setLogicBuilderOpen(true);
        break;
      case "add-field":
        setAddFieldOpen(true);
        break;
    }
  }, [
    initialModal,
    isOpen,
    hasCampaign,
    setPixelAffiliateId,
    setPixelConfigTab,
    setDeliveryClientId,
    setAffiliateCapModalId,
    setLinkClientModalOpen,
    setLinkAffiliateModalOpen,
    setCatalogOpen,
    setLogicCatalogOpen,
    setLogicBuilderOpen,
    setAddFieldOpen,
  ]);
}
