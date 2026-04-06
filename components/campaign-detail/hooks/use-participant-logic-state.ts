import { useState } from "react";
import type {
  LogicCatalogSet,
  LogicCatalogVersion,
  LogicRule,
} from "@/lib/types";

export function useParticipantLogicState() {
  const [participantLogicType, setParticipantLogicType] = useState<
    "affiliate" | "client" | null
  >(null);
  const [participantLogicRules, setParticipantLogicRules] = useState<
    LogicRule[]
  >([]);
  const [participantLogicLoading, setParticipantLogicLoading] = useState(false);
  const [participantLogicSaving, setParticipantLogicSaving] = useState(false);
  const [participantLogicBuilderOpen, setParticipantLogicBuilderOpen] =
    useState(false);
  const [participantLogicEditingRule, setParticipantLogicEditingRule] =
    useState<LogicRule | null>(null);
  const [participantLogicSetId, setParticipantLogicSetId] = useState<
    string | null
  >(null);
  const [participantLogicSetVersion, setParticipantLogicSetVersion] = useState<
    number | null
  >(null);
  const [participantLogicSetName, setParticipantLogicSetName] = useState<
    string | null
  >(null);
  const [participantLogicBaseSetId, setParticipantLogicBaseSetId] = useState<
    string | null
  >(null);
  const [participantLogicBaseSetVersion, setParticipantLogicBaseSetVersion] =
    useState<number | null>(null);
  const [participantLogicBaseSetName, setParticipantLogicBaseSetName] =
    useState<string | null>(null);
  const [participantLogicDeletingRuleId, setParticipantLogicDeletingRuleId] =
    useState<string | null>(null);
  const [participantLogicCatalogOpen, setParticipantLogicCatalogOpen] =
    useState(false);
  const [participantLogicCatalogLoading, setParticipantLogicCatalogLoading] =
    useState(false);
  const [participantLogicCatalogSets, setParticipantLogicCatalogSets] =
    useState<LogicCatalogSet[]>([]);
  const [
    participantLogicApplyingCatalogId,
    setParticipantLogicApplyingCatalogId,
  ] = useState<string | null>(null);
  const [participantExpandedSetId, setParticipantExpandedSetId] = useState<
    string | null
  >(null);
  const [participantSetVersionsMap, setParticipantSetVersionsMap] = useState<
    Record<string, LogicCatalogVersion[]>
  >({});
  const [participantLoadingVersionsFor, setParticipantLoadingVersionsFor] =
    useState<string | null>(null);
  const [participantExpandedVersionRules, setParticipantExpandedVersionRules] =
    useState<Set<string>>(new Set());
  const [participantExpandedRuleDetails, setParticipantExpandedRuleDetails] =
    useState<Set<string>>(new Set());
  const [saveParticipantLogicOpen, setSaveParticipantLogicOpen] =
    useState(false);
  const [saveParticipantLogicMode, setSaveParticipantLogicMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveParticipantLogicDraft, setSaveParticipantLogicDraft] = useState({
    name: "",
    description: "",
  });
  const [savingParticipantLogicToCatalog, setSavingParticipantLogicToCatalog] =
    useState(false);
  const [syncingClientLogicToCampaign, setSyncingClientLogicToCampaign] =
    useState(false);
  const [pinnedBaseLogicViewerOpen, setPinnedBaseLogicViewerOpen] =
    useState(false);
  const [pinnedBaseExpandedRules, setPinnedBaseExpandedRules] = useState<
    Set<string>
  >(new Set());

  return {
    participantLogicType,
    setParticipantLogicType,
    participantLogicRules,
    setParticipantLogicRules,
    participantLogicLoading,
    setParticipantLogicLoading,
    participantLogicSaving,
    setParticipantLogicSaving,
    participantLogicBuilderOpen,
    setParticipantLogicBuilderOpen,
    participantLogicEditingRule,
    setParticipantLogicEditingRule,
    participantLogicSetId,
    setParticipantLogicSetId,
    participantLogicSetVersion,
    setParticipantLogicSetVersion,
    participantLogicSetName,
    setParticipantLogicSetName,
    participantLogicBaseSetId,
    setParticipantLogicBaseSetId,
    participantLogicBaseSetVersion,
    setParticipantLogicBaseSetVersion,
    participantLogicBaseSetName,
    setParticipantLogicBaseSetName,
    participantLogicDeletingRuleId,
    setParticipantLogicDeletingRuleId,
    participantLogicCatalogOpen,
    setParticipantLogicCatalogOpen,
    participantLogicCatalogLoading,
    setParticipantLogicCatalogLoading,
    participantLogicCatalogSets,
    setParticipantLogicCatalogSets,
    participantLogicApplyingCatalogId,
    setParticipantLogicApplyingCatalogId,
    participantExpandedSetId,
    setParticipantExpandedSetId,
    participantSetVersionsMap,
    setParticipantSetVersionsMap,
    participantLoadingVersionsFor,
    setParticipantLoadingVersionsFor,
    participantExpandedVersionRules,
    setParticipantExpandedVersionRules,
    participantExpandedRuleDetails,
    setParticipantExpandedRuleDetails,
    saveParticipantLogicOpen,
    setSaveParticipantLogicOpen,
    saveParticipantLogicMode,
    setSaveParticipantLogicMode,
    saveParticipantLogicDraft,
    setSaveParticipantLogicDraft,
    savingParticipantLogicToCatalog,
    setSavingParticipantLogicToCatalog,
    syncingClientLogicToCampaign,
    setSyncingClientLogicToCampaign,
    pinnedBaseLogicViewerOpen,
    setPinnedBaseLogicViewerOpen,
    pinnedBaseExpandedRules,
    setPinnedBaseExpandedRules,
  };
}
