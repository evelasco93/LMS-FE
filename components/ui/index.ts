// Barrel re-exports — individual components live in components/ui/*
// and the hook lives in hooks/use-author-resolver.ts.
// This file exists for backward-compatibility so imports like
//   import { AuditPopover } from "@/components/shared-ui"
// continue to resolve while we migrate consumers one-by-one.

export { SectionLabel } from "@/components/ui/section-label";
export { InfoItem } from "@/components/ui/info-item";
export { AuditPopover } from "@/components/ui/audit-popover";
export { DisabledTooltip } from "@/components/ui/disabled-tooltip";
export { HoverTooltip } from "@/components/ui/hover-tooltip";
export { EditHistoryPopover } from "@/components/ui/edit-history-popover";
export { Field } from "@/components/ui/field";
export { PhoneField } from "@/components/ui/phone-field";
export { ViewWrapper } from "@/components/ui/view-wrapper";
export { inputClass } from "@/lib/utils";
