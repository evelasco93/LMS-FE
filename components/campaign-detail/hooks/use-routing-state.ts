import { useState } from "react";
import type { DistributionMode } from "@/lib/types";

export function useRoutingState() {
  const [routingMode, setRoutingMode] =
    useState<DistributionMode>("round_robin");
  const [routingEnabled, setRoutingEnabled] = useState(false);
  const [routingWeights, setRoutingWeights] = useState<Record<string, number>>(
    {},
  );
  const [savingRouting, setSavingRouting] = useState(false);
  const [confirmModeChange, setConfirmModeChange] =
    useState<DistributionMode | null>(null);

  return {
    routingMode,
    setRoutingMode,
    routingEnabled,
    setRoutingEnabled,
    routingWeights,
    setRoutingWeights,
    savingRouting,
    setSavingRouting,
    confirmModeChange,
    setConfirmModeChange,
  };
}
