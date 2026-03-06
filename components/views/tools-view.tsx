"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Shield,
  ChevronLeft,
  Check,
  X,
  ChevronDown,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { qaCheckTrustedForm, qaCheckIpqs } from "@/lib/api";
import { inputClass } from "@/lib/utils";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function ResultField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-[--color-border] last:border-0">
      <span className="text-xs text-[--color-text-muted] shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={`text-xs text-right break-all ${mono ? "font-mono text-[--color-text-muted]" : "font-medium text-[--color-text-strong]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ success }: { success: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        success
          ? "bg-[--color-success]/15 text-[--color-success]"
          : "bg-[--color-danger]/15 text-[--color-danger]"
      }`}
    >
      {success ? <Check size={12} /> : <X size={12} />}
      {success ? "Passed" : "Failed"}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  success,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  success: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[--color-border] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-[--color-bg-muted] hover:bg-[--color-bg-raised] transition-colors text-left"
      >
        <span className="text-[--color-text-muted]">{icon}</span>
        <span className="flex-1 text-sm font-medium text-[--color-text-strong]">
          {title}
        </span>
        <StatusBadge success={success} />
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[--color-text-muted] ml-1"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 space-y-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Flip Card wrapper ─────────────────────────────────────────────────────────

function FlipCard({
  front,
  back,
  flipped,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  flipped: boolean;
}) {
  return (
    <div className="w-72 h-[316px] shrink-0" style={{ perspective: 1000 }}>
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 rounded-2xl border border-[--color-border] bg-[--color-bg-raised]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </div>
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-2xl border border-[--color-border] bg-[--color-bg-raised]"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ─── TrustedForm Card ──────────────────────────────────────────────────────────

function TrustedFormCard() {
  const [flipped, setFlipped] = useState(false);
  const [certId, setCertId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const handleCheck = async () => {
    const id = certId.trim();
    if (!id) {
      toast.warning("Please enter a certificate ID or URL.");
      return;
    }
    setLoading(true);
    try {
      const res = await qaCheckTrustedForm(id);
      const data = (res as any)?.data;
      if (data) {
        setResult(data);
        setResultOpen(true);
      } else {
        toast.error((res as any)?.message || "No data returned.");
      }
    } catch (err: any) {
      toast.error(err?.message || "TrustedForm check failed.");
    } finally {
      setLoading(false);
    }
  };

  const front = (
    <button
      type="button"
      onClick={() => setFlipped(true)}
      className="w-full h-full flex flex-col items-center justify-center gap-5 p-6 rounded-2xl group"
    >
      {/* Logo area */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-green-500/20 blur-xl scale-110" />
        <div className="relative rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/20 p-5">
          <Shield size={44} strokeWidth={1.5} className="text-green-500" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-[--color-text-strong] tracking-tight">
          TrustedForm
        </p>
        <p className="text-xs text-[--color-text-muted]">
          Certificate Validator
        </p>
      </div>
      <span className="text-[11px] text-[--color-text-muted] group-hover:text-[--color-text] transition-colors">
        Click to open →
      </span>
    </button>
  );

  const back = (
    <div className="flex flex-col h-full p-4 gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFlipped(false)}
          className="rounded-md p-0.5 text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-green-500" />
          <p className="text-sm font-semibold text-[--color-text-strong]">
            TrustedForm Validator
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col justify-center gap-2.5">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-[--color-text-muted] uppercase tracking-wide">
            Certificate ID or URL
          </p>
          <input
            className={inputClass}
            placeholder="6e573ab8abffbd1a3fdbbda781b177a3…"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCheck()}
          />
          <p className="text-[11px] text-[--color-text-muted]">
            Enter a bare 40-char hex ID or fullcert URL.
          </p>
        </div>
        <p className="text-[11px] text-amber-500/90 flex items-start gap-1">
          <span className="shrink-0 mt-0.5">⚠</span>A certificate ID is required
          to run a check.
        </p>
      </div>

      <Button
        className="w-full"
        size="sm"
        onClick={handleCheck}
        disabled={loading}
      >
        {loading ? "Checking…" : "Validate Certificate"}
      </Button>
    </div>
  );

  return (
    <>
      <FlipCard front={front} back={back} flipped={flipped} />

      {/* Result Modal */}
      <Modal
        title="TrustedForm Result"
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        width={480}
      >
        {result && <TrustedFormResult data={result} />}
      </Modal>
    </>
  );
}

function TrustedFormResult({ data }: { data: Record<string, unknown> }) {
  const success = data?.outcome === "success";

  return (
    <div className="flex flex-col gap-3">
      {/* Overall — always visible, never scrolls */}
      <div
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 shrink-0 ${
          success
            ? "bg-[--color-success]/10 border border-[--color-success]/20"
            : "bg-[--color-danger]/10 border border-[--color-danger]/20"
        }`}
      >
        {success ? (
          <Check size={16} className="text-[--color-success] shrink-0" />
        ) : (
          <X size={16} className="text-[--color-danger] shrink-0" />
        )}
        <span
          className={`font-semibold text-sm ${
            success ? "text-[--color-success]" : "text-[--color-danger]"
          }`}
        >
          {success ? "Certificate Valid" : "Certificate Invalid"}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="max-h-[400px] overflow-y-auto space-y-3 pr-0.5">
        {/* Fields */}
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-1">
          {data.outcome !== undefined && (
            <ResultField label="Outcome" value={String(data.outcome)} />
          )}
          {data.cert_id !== undefined && (
            <ResultField
              label="Certificate ID"
              value={String(data.cert_id)}
              mono
            />
          )}
          {data.reason !== undefined && (
            <ResultField label="Reason" value={String(data.reason)} />
          )}
          {data.error !== undefined && (
            <ResultField label="Error" value={String(data.error)} />
          )}
          {data.vendor !== undefined && (
            <ResultField label="Retained By" value={String(data.vendor)} />
          )}
          {data.phone !== undefined && (
            <ResultField label="Phone" value={String(data.phone)} />
          )}
          {data.phone_match !== undefined && (
            <ResultField
              label="Phone Match"
              value={
                <span
                  className={
                    data.phone_match
                      ? "text-[--color-success]"
                      : "text-[--color-danger]"
                  }
                >
                  {data.phone_match ? "Yes ✓" : "No ✗"}
                </span>
              }
            />
          )}
          {data.previously_retained !== undefined && (
            <ResultField
              label="Previously Retained"
              value={data.previously_retained ? "Yes" : "No"}
            />
          )}
          {data.expires_at !== undefined && (
            <ResultField label="Expires At" value={String(data.expires_at)} />
          )}
        </div>

        {/* Unknown fields catch-all */}
        {(() => {
          const known = new Set([
            "outcome",
            "cert_id",
            "reason",
            "error",
            "vendor",
            "phone",
            "phone_match",
            "previously_retained",
            "expires_at",
            "success",
          ]);
          const extras = Object.entries(data).filter(([k]) => !known.has(k));
          if (!extras.length) return null;
          return (
            <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-1">
              {extras.map(([k, v]) => (
                <ResultField
                  key={k}
                  label={k}
                  value={
                    typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")
                  }
                  mono={typeof v === "object"}
                />
              ))}
            </div>
          );
        })()}
      </div>
      {/* end scroll */}
    </div>
  );
}

// ─── IPQS Card ─────────────────────────────────────────────────────────────────

// IPQS brand-like icon (stylised "IQ" mark)
function IpqsIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden>
      <rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="10"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <text
        x="22"
        y="30"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="-1"
        fill="currentColor"
      >
        IQ
      </text>
      <circle cx="35" cy="10" r="4" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}

function IpqsCard() {
  const [flipped, setFlipped] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    phone?: { success: boolean; raw?: Record<string, unknown>; error?: string };
    email?: { success: boolean; raw?: Record<string, unknown>; error?: string };
    ip?: { success: boolean; raw?: Record<string, unknown>; error?: string };
  } | null>(null);
  const [submittedFields, setSubmittedFields] = useState<{
    phone: boolean;
    email: boolean;
    ip: boolean;
  }>({ phone: false, email: false, ip: false });
  const [resultOpen, setResultOpen] = useState(false);

  const handleCheck = async () => {
    const p = phone.trim();
    const e = email.trim();
    const ip = ipAddress.trim();
    if (!p && !e && !ip) {
      toast.warning("Enter at least one value — phone, email, or IP address.");
      return;
    }
    const payload: Record<string, string> = {};
    if (p) payload.phone = p;
    if (e) payload.email = e;
    if (ip) payload.ip_address = ip;

    // Snapshot which fields were submitted so the modal layout is driven by
    // what the user actually sent, not by what keys the API happens to return.
    setSubmittedFields({ phone: !!p, email: !!e, ip: !!ip });

    setLoading(true);
    try {
      const res = await qaCheckIpqs(payload);
      const data = (res as any)?.data;
      if (data !== undefined) {
        setResult(data);
        setResultOpen(true);
      } else {
        toast.error((res as any)?.message || "No data returned.");
      }
    } catch (err: any) {
      toast.error(err?.message || "IPQS check failed.");
    } finally {
      setLoading(false);
    }
  };

  const front = (
    <button
      type="button"
      onClick={() => setFlipped(true)}
      className="w-full h-full flex flex-col items-center justify-center gap-5 p-6 rounded-2xl group"
    >
      {/* Logo area */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl scale-110" />
        <div className="relative rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-500/20 p-5 text-blue-400">
          <IpqsIcon size={44} />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-[--color-text-strong] tracking-tight">
          IPQS
        </p>
        <p className="text-xs text-[--color-text-muted]">Fraud Score Checker</p>
      </div>
      <span className="text-[11px] text-[--color-text-muted] group-hover:text-[--color-text] transition-colors">
        Click to open →
      </span>
    </button>
  );

  const back = (
    <div className="flex flex-col h-full p-4 gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFlipped(false)}
          className="rounded-md p-0.5 text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 text-blue-400">
          <IpqsIcon size={14} />
          <p className="text-sm font-semibold text-[--color-text-strong]">
            IPQS Fraud Check
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        <InputRow
          icon={<Phone size={12} />}
          placeholder="5551234567"
          value={phone}
          onChange={setPhone}
          label="Phone"
        />
        <InputRow
          icon={<Mail size={12} />}
          placeholder="lead@example.com"
          value={email}
          onChange={setEmail}
          label="Email"
        />
        <InputRow
          icon={<Globe size={12} />}
          placeholder="8.8.8.8"
          value={ipAddress}
          onChange={setIpAddress}
          label="IP Address"
          onEnter={() => !loading && handleCheck()}
        />
        <p className="text-[11px] text-amber-500/90 flex items-start gap-1">
          <span className="shrink-0 mt-0.5">⚠</span>
          At least one field is required to run a check.
        </p>
      </div>

      <Button
        className="w-full"
        size="sm"
        onClick={handleCheck}
        disabled={loading}
      >
        {loading ? "Checking…" : "Run Fraud Check"}
      </Button>
    </div>
  );

  return (
    <>
      <FlipCard front={front} back={back} flipped={flipped} />

      {/* Result Modal */}
      <Modal
        title="IPQS Fraud Score Result"
        isOpen={resultOpen}
        onClose={() => setResultOpen(false)}
        width={520}
      >
        {result && (
          <IpqsResult data={result} submittedFields={submittedFields} />
        )}
      </Modal>
    </>
  );
}

function InputRow({
  icon,
  label,
  placeholder,
  value,
  onChange,
  onEnter,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-1.5">
      <span className="text-[--color-text-muted] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-[--color-text-muted] uppercase tracking-wide leading-none mb-0.5">
          {label}
        </p>
        <input
          className="w-full bg-transparent text-xs text-[--color-text] placeholder:text-[--color-text-muted] outline-none"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </div>
    </div>
  );
}

function IpqsResult({
  data,
  submittedFields,
}: {
  data: {
    success: boolean;
    phone?: { success: boolean; raw?: Record<string, unknown>; error?: string };
    email?: { success: boolean; raw?: Record<string, unknown>; error?: string };
    ip?: { success: boolean; raw?: Record<string, unknown>; error?: string };
  };
  submittedFields: { phone: boolean; email: boolean; ip: boolean };
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Overall badge — always visible, never scrolls */}
      <div
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 shrink-0 ${
          data.success
            ? "bg-[--color-success]/10 border border-[--color-success]/20"
            : "bg-[--color-danger]/10 border border-[--color-danger]/20"
        }`}
      >
        {data.success ? (
          <Check size={16} className="text-[--color-success] shrink-0" />
        ) : (
          <X size={16} className="text-[--color-danger] shrink-0" />
        )}
        <span
          className={`font-semibold text-sm ${
            data.success ? "text-[--color-success]" : "text-[--color-danger]"
          }`}
        >
          Overall: {data.success ? "Passed" : "Failed"}
        </span>
      </div>

      {/* Scrollable sections */}
      <div className="max-h-[400px] overflow-y-auto space-y-3 pr-0.5">
        {/* Per-check collapsible sections — driven by what was submitted, not
          by what keys the API happens to return, so layout is always consistent. */}
        {submittedFields.phone && (
          <CollapsibleSection
            title="Phone"
            icon={<Phone size={14} />}
            success={data.phone?.success ?? false}
            defaultOpen={!(data.phone?.success ?? true)}
          >
            {data.phone?.error && (
              <ResultField label="Error" value={data.phone.error} />
            )}
            {data.phone?.raw &&
              Object.entries(data.phone.raw).map(([k, v]) => (
                <ResultField
                  key={k}
                  label={formatRawKey(k)}
                  value={formatRawValue(v)}
                  mono={typeof v === "object" && v !== null}
                />
              ))}
            {!data.phone && (
              <p className="py-1 text-xs text-[--color-text-muted]">
                No data returned.
              </p>
            )}
          </CollapsibleSection>
        )}

        {submittedFields.email && (
          <CollapsibleSection
            title="Email"
            icon={<Mail size={14} />}
            success={data.email?.success ?? false}
            defaultOpen={!(data.email?.success ?? true)}
          >
            {data.email?.error && (
              <ResultField label="Error" value={data.email.error} />
            )}
            {data.email?.raw &&
              Object.entries(data.email.raw).map(([k, v]) => (
                <ResultField
                  key={k}
                  label={formatRawKey(k)}
                  value={formatRawValue(v)}
                  mono={typeof v === "object" && v !== null}
                />
              ))}
            {!data.email && (
              <p className="py-1 text-xs text-[--color-text-muted]">
                No data returned.
              </p>
            )}
          </CollapsibleSection>
        )}

        {submittedFields.ip && (
          <CollapsibleSection
            title="IP Address"
            icon={<Globe size={14} />}
            success={data.ip?.success ?? false}
            defaultOpen={!(data.ip?.success ?? true)}
          >
            {data.ip?.error && (
              <ResultField label="Error" value={data.ip.error} />
            )}
            {data.ip?.raw &&
              Object.entries(data.ip.raw).map(([k, v]) => (
                <ResultField
                  key={k}
                  label={formatRawKey(k)}
                  value={formatRawValue(v)}
                  mono={typeof v === "object" && v !== null}
                />
              ))}
            {!data.ip && (
              <p className="py-1 text-xs text-[--color-text-muted]">
                No data returned.
              </p>
            )}
          </CollapsibleSection>
        )}
      </div>
      {/* end scrollable sections */}
    </div>
  );
}

// ─── Raw data formatting helpers ───────────────────────────────────────────────

function formatRawKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRawValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") {
    return (
      <span
        className={value ? "text-[--color-success]" : "text-[--color-danger]"}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

// ─── ToolsView ─────────────────────────────────────────────────────────────────

export function ToolsView() {
  return (
    <motion.section
      key="tools-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="space-y-6 px-1"
    >
      {/* Cards grid */}
      <div className="flex flex-wrap gap-6">
        <TrustedFormCard />
        <IpqsCard />
      </div>
    </motion.section>
  );
}
