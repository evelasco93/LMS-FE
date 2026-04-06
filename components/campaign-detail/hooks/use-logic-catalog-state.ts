import { useEffect, useState } from "react";
import { getLogicCatalogSet, listTagDefinitions } from "@/lib/api";
import type {
  Campaign,
  LogicCatalogSet,
  LogicCatalogVersion,
  LogicRule,
  TagDefinitionRecord,
} from "@/lib/types";

export function useLogicCatalogState(
  campaign: Campaign | null,
  isOpen: boolean,
) {
  // ── Logic Catalog browsing states ──────────────────────────────────────────
  const [logicCatalogOpen, setLogicCatalogOpen] = useState(false);
  const [logicCatalogLoading, setLogicCatalogLoading] = useState(false);
  const [logicCatalogSets, setLogicCatalogSets] = useState<LogicCatalogSet[]>(
    [],
  );
  const [expandedLogicSetId, setExpandedLogicSetId] = useState<string | null>(
    null,
  );
  const [logicSetVersionsMap, setLogicSetVersionsMap] = useState<
    Record<string, LogicCatalogVersion[]>
  >({});
  const [loadingLogicVersionsFor, setLoadingLogicVersionsFor] = useState<
    string | null
  >(null);
  const [applyingLogicCatalog, setApplyingLogicCatalog] = useState<
    string | null
  >(null);
  const [expandedLogicVersionRules, setExpandedLogicVersionRules] = useState<
    Set<string>
  >(new Set());
  const [expandedLogicRuleDetails, setExpandedLogicRuleDetails] = useState<
    Set<string>
  >(new Set());
  const [saveLogicToSetOpen, setSaveLogicToSetOpen] = useState(false);
  const [saveLogicToSetMode, setSaveLogicToSetMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveLogicToSetDraft, setSaveLogicToSetDraft] = useState({
    name: "",
    description: "",
  });
  const [savingLogicToSet, setSavingLogicToSet] = useState(false);

  // ── Campaign tags edit state ───────────────────────────────────────────────
  const [editTagsOpen, setEditTagsOpen] = useState(false);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinitionRecord[]>(
    [],
  );
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // ── Local logic set tracking ───────────────────────────────────────────────
  const [localLogicSetId, setLocalLogicSetId] = useState<string | null>(
    campaign?.logic_set_id ?? null,
  );
  const [localLogicSetVersion, setLocalLogicSetVersion] = useState<
    number | null
  >(campaign?.logic_set_version ?? null);
  const [localLogicSetName, setLocalLogicSetName] = useState<string | null>(
    null,
  );

  // ── Logic builder state ────────────────────────────────────────────────────
  const [logicBuilderOpen, setLogicBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LogicRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // ── Effects: sync logic state when campaign changes ────────────────────────
  useEffect(() => {
    setLocalLogicSetId(campaign?.logic_set_id ?? null);
    setLocalLogicSetVersion(campaign?.logic_set_version ?? null);
    setLocalLogicSetName(null);
    setSaveLogicToSetMode(campaign?.logic_set_id ? "new_version" : "new_set");
    setTagDraft(campaign?.tags ?? []);
  }, [campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!localLogicSetId || localLogicSetName) return;
    let cancelled = false;
    getLogicCatalogSet(localLogicSetId)
      .then((res) => {
        if (!cancelled && res.success) {
          setLocalLogicSetName(res.data.set.name);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [localLogicSetId, localLogicSetName]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listTagDefinitions()
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? [];
        setTagDefinitions(items.filter((item) => !item.is_deleted));
      })
      .catch(() => {
        if (!cancelled) setTagDefinitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setTagDraft(campaign?.tags ?? []);
  }, [campaign?.id, campaign?.tags]);

  return {
    logicCatalogOpen,
    setLogicCatalogOpen,
    logicCatalogLoading,
    setLogicCatalogLoading,
    logicCatalogSets,
    setLogicCatalogSets,
    expandedLogicSetId,
    setExpandedLogicSetId,
    logicSetVersionsMap,
    setLogicSetVersionsMap,
    loadingLogicVersionsFor,
    setLoadingLogicVersionsFor,
    applyingLogicCatalog,
    setApplyingLogicCatalog,
    expandedLogicVersionRules,
    setExpandedLogicVersionRules,
    expandedLogicRuleDetails,
    setExpandedLogicRuleDetails,
    saveLogicToSetOpen,
    setSaveLogicToSetOpen,
    saveLogicToSetMode,
    setSaveLogicToSetMode,
    saveLogicToSetDraft,
    setSaveLogicToSetDraft,
    savingLogicToSet,
    setSavingLogicToSet,
    editTagsOpen,
    setEditTagsOpen,
    tagDefinitions,
    setTagDefinitions,
    tagDraft,
    setTagDraft,
    savingTags,
    setSavingTags,
    localLogicSetId,
    setLocalLogicSetId,
    localLogicSetVersion,
    setLocalLogicSetVersion,
    localLogicSetName,
    setLocalLogicSetName,
    logicBuilderOpen,
    setLogicBuilderOpen,
    editingRule,
    setEditingRule,
    savingRule,
    setSavingRule,
    deletingRuleId,
    setDeletingRuleId,
  };
}
