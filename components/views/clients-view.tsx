"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { AuditPopover } from "@/components/ui/audit-popover";
import {
  ClientModal,
  EditClientModal,
  ClientDetailModal,
} from "@/components/modals/entity-modals";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import {
  createClient,
  updateClient,
  deleteClient,
  listClients,
} from "@/lib/api";
import { formatDate, statusColorMap } from "@/lib/utils";
import type { Client, Campaign } from "@/lib/types";

interface ClientsViewProps {
  clients: Client[];
  isLoading: boolean;
  onDataChanged: () => void;
  campaigns: Campaign[];
}

export function ClientsView({
  clients,
  isLoading,
  onDataChanged,
  campaigns,
}: ClientsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const showInactive = searchParams?.get("clients_inactive") === "true";

  const setClientsParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value === undefined) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // When showing deactivated, fetch all records (including deleted) directly.
  // The parent's `clients` prop only contains active (non-deleted) records.
  const {
    data: allClientsData,
    isLoading: allClientsLoading,
    mutate: mutateAllClients,
  } = useSWR(showInactive ? "clients:include_deleted" : null, async () => {
    const res = await listClients({ includeDeleted: true });
    return (res as any)?.data ?? [];
  });

  const displayedClients: Client[] = showInactive
    ? (allClientsData ?? [])
    : clients;
  const displayedLoading = showInactive ? allClientsLoading : isLoading;

  const [clientModal, setClientModal] = useState(false);
  const [editClientModal, setEditClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [viewClientTarget, setViewClientTarget] = useState<Client | null>(null);

  const refresh = () => {
    onDataChanged();
    if (showInactive) mutateAllClients();
  };

  const onCreateClient = async (payload: Partial<Client>) => {
    await toast.promise(
      (async () => {
        const res = await createClient(payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to create client");
        await refresh();
        setClientModal(false);
      })(),
      {
        loading: "Creating client…",
        success: "Client created",
        error: (err) => err?.message || "Unable to create client",
      },
    );
  };

  const onEditClient = async (id: string, payload: Partial<Client>) => {
    await toast.promise(
      (async () => {
        const res = await updateClient(id, payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to update client");
        await refresh();
        setEditClientModal(false);
        setEditingClient(null);
      })(),
      {
        loading: "Updating client…",
        success: "Client updated",
        error: (err) => err?.message || "Unable to update client",
      },
    );
  };

  const softDeleteDisabledReason = useMemo(() => {
    if (!deleteTarget) return undefined;
    const activeCampaigns = campaigns.filter((c) =>
      c.clients?.some(
        (cl) => cl.client_id === deleteTarget.id && cl.status !== "DISABLED",
      ),
    );
    if (activeCampaigns.length === 0) return undefined;
    const names = activeCampaigns.map((c) => `"${c.name}"`).join(", ");
    return `This client is active (TEST or LIVE) in ${names}. Set its status to DISABLED in all campaigns before deactivating.`;
  }, [deleteTarget, campaigns]);

  const hardDeleteDisabledReason = useMemo(() => {
    if (!deleteTarget) return undefined;
    const linked = campaigns.filter((c) =>
      c.clients?.some((cl) => cl.client_id === deleteTarget.id),
    );
    if (linked.length === 0) return undefined;
    const count = linked.length;
    return `This client is still linked to ${count} campaign${count !== 1 ? "s" : ""}. Remove it from all campaigns before permanently deleting.`;
  }, [deleteTarget, campaigns]);

  const onDeleteClient = async (permanent: boolean) => {
    if (!deleteTarget) return;
    await toast.promise(
      (async () => {
        const res = await deleteClient(deleteTarget.id, permanent);
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.error ||
              (res as any)?.message ||
              "Unable to delete client",
          );
        await refresh();
        setDeleteTarget(null);
      })(),
      {
        loading: permanent
          ? "Permanently deleting client…"
          : "Deactivating client…",
        success: permanent
          ? "Client permanently deleted"
          : "Client deactivated",
        error: (err) => err?.message || "Unable to delete client",
      },
    );
  };

  return (
    <motion.section
      key="clients"
      className="space-y-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[--color-text-muted]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[--color-primary]"
            checked={showInactive}
            onChange={(e) =>
              setClientsParam(
                "clients_inactive",
                e.target.checked ? "true" : undefined,
              )
            }
          />
          Show deactivated
        </label>
        <Button
          iconLeft={<Plus size={16} />}
          onClick={() => setClientModal(true)}
          data-tour="btn-new-client"
        >
          New Client
        </Button>
      </div>

      <Table
        columns={[
          {
            key: "name",
            label: "Name",
            render: (client) => (
              <span
                className={`font-medium ${
                  client.deleted_at
                    ? "text-[--color-text-muted] line-through"
                    : "text-[--color-text-strong]"
                }`}
              >
                {client.name}
              </span>
            ),
          },
          { key: "email", label: "Email" },
          {
            key: "phone",
            label: "Phone",
            render: (client) =>
              client.phone
                ? client.phone.replace(
                    /(\+\d{1,3})(\d{3})(\d{3})(\d{4})/,
                    "$1 ($2) $3-$4",
                  )
                : "—",
          },
          { key: "client_code", label: "Code" },
          {
            key: "status",
            label: "Status",
            render: (client) => (
              <Badge tone={statusColorMap[client.status] || "neutral"}>
                {client.status}
              </Badge>
            ),
          },
          {
            key: "created_at",
            label: "Created",
            render: (client) => (
              <div className="flex items-center">
                <span>{formatDate(client.created_at)}</span>
                <AuditPopover
                  createdBy={client.created_by}
                  updatedBy={client.updated_by}
                  updatedAt={client.updated_at}
                  createdAt={client.created_at}
                  entityId={client.id}
                />
              </div>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (client) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewClientTarget(client)}
                >
                  View
                </Button>
              </div>
            ),
          },
        ]}
        data={displayedClients}
        emptyLabel={
          displayedLoading ? "Loading clients…" : "No clients yet. Add one."
        }
      />

      <ClientModal
        isOpen={clientModal}
        onClose={() => setClientModal(false)}
        onSubmit={onCreateClient}
      />
      <EditClientModal
        isOpen={editClientModal}
        client={editingClient}
        onClose={() => {
          setEditClientModal(false);
          setEditingClient(null);
        }}
        onSubmit={onEditClient}
      />
      <ClientDetailModal
        client={viewClientTarget}
        isOpen={!!viewClientTarget}
        onClose={() => setViewClientTarget(null)}
        onSave={onEditClient}
        onRequestDelete={(client) => setDeleteTarget(client)}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteClient}
        entityType="client"
        entityName={deleteTarget?.name || ""}
        canHardDelete
        softDeleteDisabledReason={softDeleteDisabledReason}
        hardDeleteDisabledReason={hardDeleteDisabledReason}
      />
    </motion.section>
  );
}
