import { useEffect, useState } from "react";
import { getCriteriaCatalogSet } from "@/lib/api";
import type {
  Campaign,
  CasingMode,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaFieldType,
  CriteriaCatalogSet,
  CriteriaCatalogVersion,
} from "@/lib/types";

// ─── Catalog field draft type (used when creating/editing catalog sets) ──────
type CatalogFieldDraft = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  description: string;
  state_mapping: "abbr_to_name" | "name_to_abbr" | null;
};

export function useCriteriaCatalogState(campaign: Campaign | null) {
  // ── Criteria Catalog browsing states ───────────────────────────────────────
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSets, setCatalogSets] = useState<CriteriaCatalogSet[]>([]);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setVersionsMap, setSetVersionsMap] = useState<
    Record<string, CriteriaCatalogVersion[]>
  >({});
  const [loadingVersionsFor, setLoadingVersionsFor] = useState<string | null>(
    null,
  );
  const [applyingCatalog, setApplyingCatalog] = useState<string | null>(null);
  const [catalogFormMode, setCatalogFormMode] = useState<
    "browse" | "create" | "edit"
  >("browse");
  const [editingCatalogSet, setEditingCatalogSet] =
    useState<CriteriaCatalogSet | null>(null);
  const [catalogFormDraft, setCatalogFormDraft] = useState({
    name: "",
    description: "",
  });
  const [catalogFieldDrafts, setCatalogFieldDrafts] = useState<
    CatalogFieldDraft[]
  >([]);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogBulkImportOpen, setCatalogBulkImportOpen] = useState(false);
  const [catalogBulkImportText, setCatalogBulkImportText] = useState("");
  const [campaignBulkImportOpen, setCampaignBulkImportOpen] = useState(false);
  const [campaignBulkImportText, setCampaignBulkImportText] = useState("");
  const [campaignBulkImporting, setCampaignBulkImporting] = useState(false);
  const [confirmDeleteSet, setConfirmDeleteSet] =
    useState<CriteriaCatalogSet | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  const [expandedVersionFields, setExpandedVersionFields] = useState<
    Set<string>
  >(new Set());

  // ── Local criteria set tracking ────────────────────────────────────────────
  const [localCriteriaSetId, setLocalCriteriaSetId] = useState<string | null>(
    campaign?.criteria_set_id ?? null,
  );
  const [localCriteriaSetVersion, setLocalCriteriaSetVersion] = useState<
    number | null
  >(campaign?.criteria_set_version ?? null);
  const [localCriteriaSetName, setLocalCriteriaSetName] = useState<
    string | null
  >(null);

  // ── Save criteria to catalog ───────────────────────────────────────────────
  const [saveCriteriaToSetOpen, setSaveCriteriaToSetOpen] = useState(false);
  const [saveCriteriaToSetMode, setSaveCriteriaToSetMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveCriteriaToSetDraft, setSaveCriteriaToSetDraft] = useState({
    name: "",
    description: "",
  });
  const [savingCriteriaToSet, setSavingCriteriaToSet] = useState(false);

  // ── Criteria field editing ─────────────────────────────────────────────────
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [editFieldData, setEditFieldData] = useState<CriteriaField | null>(
    null,
  );
  const [listMappingsField, setListMappingsField] =
    useState<CriteriaField | null>(null);
  const [listMappingsDraft, setListMappingsDraft] = useState<
    CriteriaFieldOption[]
  >([]);
  const [listMappingsSaving, setListMappingsSaving] = useState(false);
  const [valueMappingsField, setValueMappingsField] =
    useState<CriteriaField | null>(null);
  const [valueMappingsDraft, setValueMappingsDraft] = useState<
    { fromText: string; to: string }[]
  >([]);
  const [valueMappingsStateDraft, setValueMappingsStateDraft] = useState<
    "abbr_to_name" | "name_to_abbr" | null
  >(null);
  const [valueMappingsSaving, setValueMappingsSaving] = useState(false);
  const [optionsTab, setOptionsTab] = useState<"manual" | "bulk">("manual");
  const [optionsBulkText, setOptionsBulkText] = useState("");
  const [deleteFieldTarget, setDeleteFieldTarget] =
    useState<CriteriaField | null>(null);
  const [deletingField, setDeletingField] = useState(false);
  const emptyFieldDraft = {
    field_label: "",
    field_name: "",
    data_type: "Text" as CriteriaFieldType,
    required: true,
    description: "",
    state_mapping: null as "abbr_to_name" | "name_to_abbr" | null,
    options: [] as CriteriaFieldOption[],
    casing: "default" as CasingMode,
  };
  const [fieldDraft, setFieldDraft] = useState<{
    field_label: string;
    field_name: string;
    data_type: CriteriaFieldType;
    required: boolean;
    description: string;
    state_mapping: "abbr_to_name" | "name_to_abbr" | null;
    options: CriteriaFieldOption[];
    casing: CasingMode;
  }>(emptyFieldDraft);
  const [fieldSaving, setFieldSaving] = useState(false);

  // ── Effects: sync local criteria set when campaign changes ─────────────────
  useEffect(() => {
    setLocalCriteriaSetId(campaign?.criteria_set_id ?? null);
    setLocalCriteriaSetVersion(campaign?.criteria_set_version ?? null);
    setLocalCriteriaSetName(null);
  }, [campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!localCriteriaSetId || localCriteriaSetName) return;
    let cancelled = false;
    getCriteriaCatalogSet(localCriteriaSetId)
      .then((res) => {
        if (!cancelled && res.success) {
          setLocalCriteriaSetName(res.data.set.name);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [localCriteriaSetId, localCriteriaSetName]);

  return {
    catalogOpen,
    setCatalogOpen,
    catalogLoading,
    setCatalogLoading,
    catalogSets,
    setCatalogSets,
    expandedSetId,
    setExpandedSetId,
    setVersionsMap,
    setSetVersionsMap,
    loadingVersionsFor,
    setLoadingVersionsFor,
    applyingCatalog,
    setApplyingCatalog,
    catalogFormMode,
    setCatalogFormMode,
    editingCatalogSet,
    setEditingCatalogSet,
    catalogFormDraft,
    setCatalogFormDraft,
    catalogFieldDrafts,
    setCatalogFieldDrafts,
    savingCatalog,
    setSavingCatalog,
    catalogBulkImportOpen,
    setCatalogBulkImportOpen,
    catalogBulkImportText,
    setCatalogBulkImportText,
    campaignBulkImportOpen,
    setCampaignBulkImportOpen,
    campaignBulkImportText,
    setCampaignBulkImportText,
    campaignBulkImporting,
    setCampaignBulkImporting,
    confirmDeleteSet,
    setConfirmDeleteSet,
    deletingSet,
    setDeletingSet,
    expandedVersionFields,
    setExpandedVersionFields,
    localCriteriaSetId,
    setLocalCriteriaSetId,
    localCriteriaSetVersion,
    setLocalCriteriaSetVersion,
    localCriteriaSetName,
    setLocalCriteriaSetName,
    saveCriteriaToSetOpen,
    setSaveCriteriaToSetOpen,
    saveCriteriaToSetMode,
    setSaveCriteriaToSetMode,
    saveCriteriaToSetDraft,
    setSaveCriteriaToSetDraft,
    savingCriteriaToSet,
    setSavingCriteriaToSet,
    addFieldOpen,
    setAddFieldOpen,
    editFieldData,
    setEditFieldData,
    listMappingsField,
    setListMappingsField,
    listMappingsDraft,
    setListMappingsDraft,
    listMappingsSaving,
    setListMappingsSaving,
    valueMappingsField,
    setValueMappingsField,
    valueMappingsDraft,
    setValueMappingsDraft,
    valueMappingsStateDraft,
    setValueMappingsStateDraft,
    valueMappingsSaving,
    setValueMappingsSaving,
    optionsTab,
    setOptionsTab,
    optionsBulkText,
    setOptionsBulkText,
    deleteFieldTarget,
    setDeleteFieldTarget,
    deletingField,
    setDeletingField,
    emptyFieldDraft,
    fieldDraft,
    setFieldDraft,
    fieldSaving,
    setFieldSaving,
  };
}
