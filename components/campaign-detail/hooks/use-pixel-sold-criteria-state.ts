import { useState } from "react";
import type { LogicRule } from "@/lib/types";

export function usePixelSoldCriteriaState() {
  // ── Per-affiliate pixel criteria manager ──────────────────────────────────
  const [pixelCriteriaAffiliateId, setPixelCriteriaAffiliateId] = useState<
    string | null
  >(null);
  const [pixelCriteriaRules, setPixelCriteriaRules] = useState<LogicRule[]>([]);
  const [pixelCriteriaLoading, setPixelCriteriaLoading] = useState(false);
  const [pixelCriteriaSaving, setPixelCriteriaSaving] = useState(false);
  const [pixelCriteriaBuilderOpen, setPixelCriteriaBuilderOpen] =
    useState(false);
  const [pixelCriteriaEditingRule, setPixelCriteriaEditingRule] =
    useState<LogicRule | null>(null);
  const [pixelCriteriaDeletingRuleId, setPixelCriteriaDeletingRuleId] =
    useState<string | null>(null);

  // ── Per-affiliate sold criteria manager ───────────────────────────────────
  const [soldCriteriaAffiliateId, setSoldCriteriaAffiliateId] = useState<
    string | null
  >(null);
  const [soldCriteriaRules, setSoldCriteriaRules] = useState<LogicRule[]>([]);
  const [soldCriteriaLoading, setSoldCriteriaLoading] = useState(false);
  const [soldCriteriaSaving, setSoldCriteriaSaving] = useState(false);
  const [soldCriteriaBuilderOpen, setSoldCriteriaBuilderOpen] = useState(false);
  const [soldCriteriaEditingRule, setSoldCriteriaEditingRule] =
    useState<LogicRule | null>(null);
  const [soldCriteriaDeletingRuleId, setSoldCriteriaDeletingRuleId] = useState<
    string | null
  >(null);

  return {
    pixelCriteriaAffiliateId,
    setPixelCriteriaAffiliateId,
    pixelCriteriaRules,
    setPixelCriteriaRules,
    pixelCriteriaLoading,
    setPixelCriteriaLoading,
    pixelCriteriaSaving,
    setPixelCriteriaSaving,
    pixelCriteriaBuilderOpen,
    setPixelCriteriaBuilderOpen,
    pixelCriteriaEditingRule,
    setPixelCriteriaEditingRule,
    pixelCriteriaDeletingRuleId,
    setPixelCriteriaDeletingRuleId,
    soldCriteriaAffiliateId,
    setSoldCriteriaAffiliateId,
    soldCriteriaRules,
    setSoldCriteriaRules,
    soldCriteriaLoading,
    setSoldCriteriaLoading,
    soldCriteriaSaving,
    setSoldCriteriaSaving,
    soldCriteriaBuilderOpen,
    setSoldCriteriaBuilderOpen,
    soldCriteriaEditingRule,
    setSoldCriteriaEditingRule,
    soldCriteriaDeletingRuleId,
    setSoldCriteriaDeletingRuleId,
  };
}
