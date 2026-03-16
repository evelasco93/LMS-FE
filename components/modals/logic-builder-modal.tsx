"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { inputClass } from "@/lib/utils";
import type { CriteriaField, LogicRule, LogicRuleOperator } from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────

export const OPERATOR_LABELS: Record<LogicRuleOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const ALL_OPERATORS: LogicRuleOperator[] = [
  "is",
  "is_not",
  "contains",
  "does_not_contain",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "is_empty",
  "is_not_empty",
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

// ─── Draft types ─────────────────────────────────────────────────────────────

interface DraftCondition {
  field_name: string;
  operator: LogicRuleOperator;
  value: string | string[];
}

interface DraftGroup {
  conditions: DraftCondition[];
}

const EMPTY_CONDITION: DraftCondition = {
  field_name: "",
  operator: "is",
  value: "",
};

// ─── MultiSelectDropdown ─────────────────────────────────────────────────────

function MultiSelectDropdown({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : options;

  const displayText =
    value.length === 0
      ? "Select…"
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`;

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputClass} flex items-center justify-between gap-2 w-full text-left`}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-[60] top-full left-0 right-0 mt-1 rounded-lg border border-[--color-border] bg-[--color-bg] shadow-lg flex flex-col"
          style={{ minWidth: 200 }}
        >
          {/* Search */}
          <div className="p-1.5 border-b border-[--color-border]">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full rounded-md px-2.5 py-1.5 text-sm bg-[--color-bg-muted] border border-[--color-border] text-[--color-text] placeholder:text-[--color-text-muted] outline-none focus:border-[--color-primary]"
            />
          </div>
          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[--color-text-muted]">
                No matches
              </p>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-[--color-bg-muted] text-[--color-text]"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="accent-[--color-primary]"
                  />
                  {opt.label}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ConditionValueInput ──────────────────────────────────────────────────────

function ConditionValueInput({
  field,
  operator,
  value,
  onChange,
}: {
  field: CriteriaField | undefined;
  operator: LogicRuleOperator;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  if (operator === "is_empty" || operator === "is_not_empty") {
    return <div className="flex-[2] min-w-0" />;
  }

  const supportsMulti = operator === "is" || operator === "is_not";
  const arrayValue = Array.isArray(value) ? value : value ? [value] : [];

  if (field?.data_type === "List" && field.options?.length && supportsMulti) {
    return (
      <MultiSelectDropdown
        options={field.options.map((o) => ({ label: o.label, value: o.value }))}
        value={arrayValue}
        onChange={onChange}
      />
    );
  }

  if (field?.data_type === "US State" && supportsMulti) {
    return (
      <MultiSelectDropdown
        options={US_STATES.map((s) => ({ label: s, value: s }))}
        value={arrayValue}
        onChange={onChange}
      />
    );
  }

  if (field?.data_type === "Boolean") {
    return (
      <select
        className={`${inputClass} flex-[2] min-w-0`}
        value={Array.isArray(value) ? (value[0] ?? "") : value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  return (
    <input
      className={`${inputClass} flex-[2] min-w-0`}
      value={Array.isArray(value) ? value.join(", ") : value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value…"
    />
  );
}

// ─── LogicRuleDraft ───────────────────────────────────────────────────────────

export interface LogicRuleDraft {
  name: string;
  action: "pass" | "fail";
  enabled: boolean;
  groups: {
    conditions: {
      field_name: string;
      operator: string;
      value?: string | string[];
    }[];
  }[];
}

// ─── LogicBuilderModal ────────────────────────────────────────────────────────

export function LogicBuilderModal({
  isOpen,
  onClose,
  onSave,
  rule,
  criteriaFields,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: LogicRuleDraft) => void;
  rule: LogicRule | null;
  criteriaFields: CriteriaField[];
  saving?: boolean;
}) {
  const [name, setName] = useState("");
  const [action, setAction] = useState<"pass" | "fail">("pass");
  const [groups, setGroups] = useState<DraftGroup[]>([
    { conditions: [{ ...EMPTY_CONDITION }] },
  ]);

  // Sync from rule when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setName(rule.name);
      setAction(rule.action);
      setGroups(
        rule.groups.map((g) => ({
          conditions: g.conditions.map((c) => ({
            field_name: c.field_name,
            operator: c.operator,
            value: c.value ?? "",
          })),
        })),
      );
    } else {
      setName("");
      setAction("pass");
      setGroups([{ conditions: [{ ...EMPTY_CONDITION }] }]);
    }
  }, [isOpen, rule]);

  // ─── Group/condition helpers ─────────────────────────────────────────────

  const addGroup = () =>
    setGroups((g) => [...g, { conditions: [{ ...EMPTY_CONDITION }] }]);

  const removeGroup = (gi: number) =>
    setGroups((g) => g.filter((_, i) => i !== gi));

  const addCondition = (gi: number) =>
    setGroups((g) =>
      g.map((grp, i) =>
        i === gi
          ? { ...grp, conditions: [...grp.conditions, { ...EMPTY_CONDITION }] }
          : grp,
      ),
    );

  const removeCondition = (gi: number, ci: number) =>
    setGroups((g) =>
      g.map((grp, i) =>
        i === gi
          ? { ...grp, conditions: grp.conditions.filter((_, j) => j !== ci) }
          : grp,
      ),
    );

  const updateCondition = (
    gi: number,
    ci: number,
    patch: Partial<DraftCondition>,
  ) =>
    setGroups((g) =>
      g.map((grp, i) =>
        i === gi
          ? {
              ...grp,
              conditions: grp.conditions.map((c, j) =>
                j === ci ? { ...c, ...patch } : c,
              ),
            }
          : grp,
      ),
    );

  const handleFieldChange = (gi: number, ci: number, field_name: string) =>
    updateCondition(gi, ci, { field_name, value: "" });

  const handleOperatorChange = (
    gi: number,
    ci: number,
    operator: LogicRuleOperator,
  ) => {
    const noValue = operator === "is_empty" || operator === "is_not_empty";
    updateCondition(gi, ci, { operator, ...(noValue ? { value: "" } : {}) });
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const draft: LogicRuleDraft = {
      name: name.trim(),
      action,
      enabled: rule?.enabled ?? true,
      groups: groups
        .map((g) => ({
          conditions: g.conditions
            .filter((c) => c.field_name && c.operator)
            .map((c) => {
              const noValue =
                c.operator === "is_empty" || c.operator === "is_not_empty";
              const val = Array.isArray(c.value)
                ? c.value.filter(Boolean)
                : typeof c.value === "string"
                  ? c.value.trim()
                  : c.value;
              return {
                field_name: c.field_name,
                operator: c.operator,
                ...(!noValue &&
                val !== "" &&
                !(Array.isArray(val) && val.length === 0)
                  ? { value: val }
                  : {}),
              };
            }),
        }))
        .filter((g) => g.conditions.length > 0),
    };
    onSave(draft);
  };

  const canSave =
    name.trim().length > 0 &&
    groups.some((g) => g.conditions.some((c) => c.field_name));

  return (
    <Modal
      title={
        <div>
          <p className="text-lg font-semibold text-[--color-text-strong]">
            Logic Builder
          </p>
          <p className="text-xs font-normal text-[--color-text-muted] mt-0.5">
            {rule ? rule.name || rule.id : "New Rule"}
          </p>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      width={700}
    >
      <div className="space-y-5">
        {/* Rule name */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-[--color-text-muted] uppercase tracking-wide">
            Rule Name
          </p>
          <input
            className={inputClass}
            placeholder="e.g. Reject Non-California Leads"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Action toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[--color-text-muted]">
            Action:
          </span>
          <div className="flex items-center gap-0.5 rounded-lg border border-[--color-border] p-0.5 bg-[--color-bg-muted]">
            <button
              type="button"
              onClick={() => setAction("pass")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                action === "pass"
                  ? "bg-green-500 text-white shadow-sm"
                  : "text-[--color-text-muted] hover:text-[--color-text]"
              }`}
            >
              Pass
            </button>
            <button
              type="button"
              onClick={() => setAction("fail")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                action === "fail"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-[--color-text-muted] hover:text-[--color-text]"
              }`}
            >
              Fail
            </button>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-3">
          {groups.map((group, gi) => (
            <div
              key={gi}
              className="rounded-xl border border-[--color-border] border-l-[3px] border-l-red-400 pl-4 pr-3 py-3 space-y-2"
            >
              {/* Group header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-widest">
                  Group {gi + 1}
                </span>
                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGroup(gi)}
                    className="text-[--color-text-muted] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Condition rows */}
              {group.conditions.map((cond, ci) => {
                const field = criteriaFields.find(
                  (f) => f.field_name === cond.field_name,
                );
                const isLast = ci === group.conditions.length - 1;
                const onlyOne =
                  group.conditions.length === 1 && groups.length === 1;
                return (
                  <div key={ci} className="flex items-center gap-2">
                    {/* Field */}
                    <select
                      className={`${inputClass} flex-[2] min-w-0`}
                      value={cond.field_name}
                      onChange={(e) =>
                        handleFieldChange(gi, ci, e.target.value)
                      }
                    >
                      <option value="">Select field…</option>
                      {criteriaFields.map((f) => (
                        <option key={f.id} value={f.field_name}>
                          {f.field_label}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      className={`${inputClass} flex-[1.5] min-w-0`}
                      value={cond.operator}
                      onChange={(e) =>
                        handleOperatorChange(
                          gi,
                          ci,
                          e.target.value as LogicRuleOperator,
                        )
                      }
                    >
                      {ALL_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    <ConditionValueInput
                      field={field}
                      operator={cond.operator}
                      value={cond.value}
                      onChange={(v) => updateCondition(gi, ci, { value: v })}
                    />

                    {/* AND badge — only on last condition when >1 exist */}
                    {isLast && group.conditions.length > 1 && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white">
                        AND
                      </span>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={onlyOne}
                      onClick={() => {
                        if (group.conditions.length === 1) {
                          removeGroup(gi);
                        } else {
                          removeCondition(gi, ci);
                        }
                      }}
                      className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-25"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {/* Add condition */}
              <button
                type="button"
                onClick={() => addCondition(gi)}
                className="mt-1 text-[11px] text-[--color-primary] hover:opacity-75 flex items-center gap-1 transition-opacity"
              >
                <Plus size={11} />
                Add condition
              </button>
            </div>
          ))}

          {/* Add group (OR) */}
          <button
            type="button"
            onClick={addGroup}
            className="w-full rounded-xl border border-dashed border-[--color-border] py-3 text-sm text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
          >
            + Add New Group (OR)
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[--color-border]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? "Saving…" : "Save Rule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
