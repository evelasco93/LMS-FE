"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Field, PhoneField } from "@/components/shared-ui";
import { inputClass, generateCodeFromName } from "@/lib/utils";
import type { Affiliate, Client, Credential } from "@/lib/types";
import type { AffiliateStatus, ClientStatus } from "@/lib/types";

// ─── ClientModal ──────────────────────────────────────────────────────────────

export function ClientModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  return (
    <Modal title="Create Client" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Client> = {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || undefined,
            client_code: form.client_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ops@acme.com"
          />
        </Field>
        <Field label="Phone">
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Client Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.client_code || ""}
              onChange={(e) =>
                setForm({ ...form, client_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() => setForm({ ...form, client_code: generateCode() })}
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── EditClientModal ──────────────────────────────────────────────────────────

export function EditClientModal({
  isOpen,
  onClose,
  client,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSubmit: (id: string, payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>({});

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        email: client.email,
        phone: client.phone,
        client_code: client.client_code,
        status: client.status,
      });
    }
  }, [client]);

  if (!client) return null;

  const clientStatusOptions: ClientStatus[] = ["ACTIVE", "INACTIVE"];

  return (
    <Modal
      title={`Edit Client \u2014 ${client.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(client.id, {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || undefined,
            client_code: form.client_code?.trim() || undefined,
            status: form.status,
          });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Client Code">
          <input
            className={inputClass}
            value={form.client_code || ""}
            onChange={(e) => setForm({ ...form, client_code: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status || "ACTIVE"}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ClientStatus })
            }
          >
            {clientStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── AffiliateModal ───────────────────────────────────────────────────────────

export function AffiliateModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Affiliate>) => void;
}) {
  const [form, setForm] = useState<Partial<Affiliate>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  return (
    <Modal title="Create Affiliate" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Affiliate> = {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || "",
            affiliate_code: form.affiliate_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Growth Partners"
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="contact@growth.io"
          />
        </Field>
        <Field label="Phone" required>
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Affiliate Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.affiliate_code || ""}
              onChange={(e) =>
                setForm({ ...form, affiliate_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() =>
                setForm({ ...form, affiliate_code: generateCode() })
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── EditAffiliateModal ───────────────────────────────────────────────────────

export function EditAffiliateModal({
  isOpen,
  onClose,
  affiliate,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  affiliate: Affiliate | null;
  onSubmit: (id: string, payload: Partial<Affiliate>) => void;
}) {
  const [form, setForm] = useState<Partial<Affiliate>>({});

  useEffect(() => {
    if (affiliate) {
      setForm({
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        affiliate_code: affiliate.affiliate_code,
        status: affiliate.status,
      });
    }
  }, [affiliate]);

  if (!affiliate) return null;

  const generateCode = () => generateCodeFromName(form.name || "", "");
  const affiliateStatusOptions: AffiliateStatus[] = ["ACTIVE", "INACTIVE"];

  return (
    <Modal
      title={`Edit Affiliate \u2014 ${affiliate.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(affiliate.id, {
            name: form.name?.trim() || "",
            email: form.email?.trim() || "",
            phone: form.phone?.trim() || "",
            affiliate_code: form.affiliate_code?.trim() || undefined,
            status: form.status,
          });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </Field>
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email || ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone" required>
          <PhoneField
            value={form.phone || ""}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
        </Field>
        <Field label="Affiliate Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.affiliate_code || ""}
              onChange={(e) =>
                setForm({ ...form, affiliate_code: e.target.value })
              }
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() =>
                setForm({ ...form, affiliate_code: generateCode() })
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status || "ACTIVE"}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as AffiliateStatus })
            }
          >
            {affiliateStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── CredentialModal ──────────────────────────────────────────────────────────

export function CredentialModal({
  isOpen,
  onClose,
  onSubmit,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Credential) => void;
  initial?: Credential | null;
}) {
  const blank: Credential = {
    provider: "",
    type: "api_key",
    credentials: {},
  };
  const [form, setForm] = useState<Credential>(initial ?? blank);

  useEffect(() => {
    setForm(initial ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const setField = <K extends keyof Credential>(key: K, value: Credential[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setCredField = (key: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }));

  return (
    <Modal
      title={initial ? "Edit Credential" : "New Credential"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...form, provider: form.provider.trim() });
        }}
      >
        <Field label="Provider" required>
          <input
            required
            className={inputClass}
            value={form.provider}
            onChange={(e) => setField("provider", e.target.value)}
            placeholder="e.g. salesforce, sendgrid"
            disabled={!!initial}
          />
        </Field>
        <Field label="Type" required>
          <select
            required
            className={inputClass}
            value={form.type}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                type: e.target.value as Credential["type"],
                credentials: {},
              }))
            }
          >
            <option value="api_key">API Key</option>
            <option value="basic_auth">Basic Auth</option>
            <option value="bearer_token">Bearer Token</option>
          </select>
        </Field>
        {form.type === "api_key" && (
          <Field label="API Key" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.apiKey ?? ""}
              onChange={(e) => setCredField("apiKey", e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
          </Field>
        )}
        {form.type === "basic_auth" && (
          <>
            <Field label="Username" required>
              <input
                required
                className={inputClass}
                value={form.credentials.username ?? ""}
                onChange={(e) => setCredField("username", e.target.value)}
                placeholder="username"
                autoComplete="off"
              />
            </Field>
            <Field label="Password" required>
              <input
                required
                type="password"
                className={inputClass}
                value={form.credentials.password ?? ""}
                onChange={(e) => setCredField("password", e.target.value)}
                placeholder="password"
                autoComplete="off"
              />
            </Field>
          </>
        )}
        {form.type === "bearer_token" && (
          <Field label="Token" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.token ?? ""}
              onChange={(e) => setCredField("token", e.target.value)}
              placeholder="Bearer token…"
              autoComplete="off"
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{initial ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── CampaignModal ────────────────────────────────────────────────────────────

export function CampaignModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string }) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Modal title="Create Campaign" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring Promo"
          />
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          Campaigns start as DRAFT. Link a client and affiliate to move to TEST.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── LinkClientModal ──────────────────────────────────────────────────────────

export function LinkClientModal({
  isOpen,
  onClose,
  clients,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSubmit: (clientId: string) => void | Promise<void>;
}) {
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (!isOpen) setClientId("");
  }, [isOpen]);

  return (
    <Modal title="Add Client to Campaign" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Client" required>
          <select
            className={inputClass}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.client_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!clientId) return;
              onSubmit(clientId);
            }}
            disabled={!clientId}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── LinkAffiliateModal ───────────────────────────────────────────────────────

export function LinkAffiliateModal({
  isOpen,
  onClose,
  affiliates,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  affiliates: Affiliate[];
  onSubmit: (affiliateId: string) => void | Promise<void>;
}) {
  const [affiliateId, setAffiliateId] = useState("");

  useEffect(() => {
    if (!isOpen) setAffiliateId("");
  }, [isOpen]);

  return (
    <Modal title="Add Affiliate to Campaign" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Affiliate" required>
          <select
            className={inputClass}
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
          >
            <option value="">Select affiliate</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.affiliate_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!affiliateId) return;
              onSubmit(affiliateId);
            }}
            disabled={!affiliateId}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
