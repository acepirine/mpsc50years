import {
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconSearch,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AccountStatus, type Alumna, ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  component: AdminPanel,
});

const STATUS_TABS: { value: AccountStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: "Pending review",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "confirmed" && "bg-accent/20 text-accent-foreground",
        status === "pending" && "bg-secondary text-secondary-foreground",
        status === "cancelled" && "bg-destructive/10 text-destructive",
      )}
    >
      {status === "confirmed" && <IconCircleCheck className="size-3.5" />}
      {status === "pending" && <IconClock className="size-3.5" />}
      {status === "cancelled" && <IconCircleX className="size-3.5" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function PaymentBadge({ alumna }: { alumna: Alumna }) {
  const { has_paid, latest_status, amount } = alumna.payment;

  if (has_paid) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-accent-foreground">
        <IconCircleCheck className="size-3.5" />
        Paid {amount !== null ? `${amount} BDT` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <IconCircleX className="size-3.5" />
      {latest_status === "unpaid" ? "Not paid" : latest_status}
    </span>
  );
}

function AdminPanel() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [counts, setCounts] = useState<Record<AccountStatus, number> | null>(
    null,
  );
  const [tab, setTab] = useState<AccountStatus | "all">("pending");
  const [alumnae, setAlumnae] = useState<Alumna[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Which row is mid-update, so only that row's buttons disable.
  const [updating, setUpdating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A 401 anywhere means the session expired; send them back to the form.
  const handleAuthFailure = useCallback(
    async (caught: unknown) => {
      if (caught instanceof ApiError && caught.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      setError(
        caught instanceof ApiError ? caught.detail : "Something went wrong.",
      );
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function check() {
      try {
        await api.adminSession(controller.signal);
        if (!cancelled) setChecking(false);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        setError("Cannot reach the server.");
        setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [navigate]);

  const load = useCallback(
    async (status: AccountStatus | "all", signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const [rows, statusCounts] = await Promise.all([
          api.adminAlumnae(
            status === "all" ? undefined : { status, limit: 200 },
            signal,
          ),
          api.adminCounts(signal),
        ]);
        setAlumnae(rows);
        setCounts(statusCounts);
      } catch (caught) {
        if (signal?.aborted) return;
        await handleAuthFailure(caught);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [handleAuthFailure],
  );

  useEffect(() => {
    if (checking) return;
    const controller = new AbortController();
    load(tab, controller.signal);
    return () => controller.abort();
  }, [tab, checking, load]);

  async function changeStatus(alumna: Alumna, newStatus: AccountStatus) {
    // Only cancel confirms: it is the expensive mistake to undo.
    if (
      newStatus === "cancelled" &&
      !window.confirm(
        `Cancel ${alumna.full_name}? They will be signed out and unable to pay.`,
      )
    ) {
      return;
    }

    setUpdating(alumna.uuid);
    setNotice(null);

    try {
      const updated = await api.adminUpdateStatus(alumna.uuid, newStatus);
      // Patch in place so the row does not jump while counts refresh.
      setAlumnae((rows) =>
        rows.map((row) => (row.uuid === updated.uuid ? updated : row)),
      );
      setNotice(
        newStatus === "confirmed"
          ? `${updated.full_name} approved.`
          : `${updated.full_name} cancelled.`,
      );
      const statusCounts = await api.adminCounts();
      setCounts(statusCounts);
    } catch (caught) {
      await handleAuthFailure(caught);
    } finally {
      setUpdating(null);
    }
  }

  async function handleSignOut() {
    try {
      await api.adminLogout();
    } catch {
      // Sign out locally regardless; staying signed in on a shared machine is worse.
    }
    await navigate({ to: "/admin/login" });
  }

  // Client-side: the API has no search parameter.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return alumnae;
    return alumnae.filter(
      (alumna) =>
        alumna.full_name.toLowerCase().includes(needle) ||
        alumna.email.toLowerCase().includes(needle) ||
        alumna.phone_number.toLowerCase().includes(needle) ||
        (alumna.profile?.reg_code ?? "").toLowerCase().includes(needle),
    );
  }, [alumnae, query]);

  if (checking) {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking session...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 pt-32 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Registrations</h1>
          <p className="text-sm text-muted-foreground">
            Approve alumnae who have paid to complete their registration.
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3 pb-4">
        <div
          className="flex flex-wrap items-center gap-1 rounded-full border border-muted p-1"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-sm transition-colors",
                tab === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {label}
              {counts && value !== "all" && (
                <span className="ml-1.5 tabular-nums opacity-70">
                  {counts[value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative min-w-56 flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search registrations"
            placeholder="Name, email, phone or reg code"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-accent/20 px-3 py-2 text-sm text-accent-foreground"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {query
            ? "No registrations match that search."
            : "No registrations in this view."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-secondary/50 text-xs tracking-wide uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Alumna</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Shirt</th>
                <th className="px-3 py-2 font-medium">Payment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((alumna) => (
                <tr
                  key={alumna.uuid}
                  className="border-t border-border align-top"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{alumna.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {alumna.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {alumna.phone_number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reg {alumna.profile?.reg_code ?? "-"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {alumna.profile?.batch_year ?? "-"}
                    {alumna.profile?.academic_group && (
                      <div className="text-xs text-muted-foreground capitalize">
                        {alumna.profile.academic_group.replace(/_/g, " ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {alumna.profile?.tee_shirt_size ?? "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <PaymentBadge alumna={alumna} />
                    {alumna.payment.has_paid && alumna.payment.paid_at && (
                      <div className="text-xs text-muted-foreground">
                        {formatDate(alumna.payment.paid_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={alumna.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(alumna.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {alumna.status !== "confirmed" && (
                        <Button
                          size="sm"
                          isDisabled={updating === alumna.uuid}
                          onClick={() => changeStatus(alumna, "confirmed")}
                        >
                          Approve
                        </Button>
                      )}
                      {alumna.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          isDisabled={updating === alumna.uuid}
                          onClick={() => changeStatus(alumna, "cancelled")}
                        >
                          Cancel
                        </Button>
                      )}
                      {alumna.status === "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={updating === alumna.uuid}
                          onClick={() => changeStatus(alumna, "confirmed")}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
