import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCreditCard,
  IconLoader2,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AccountStatus,
  ApiError,
  api,
  type Payment,
  type PaymentStatus,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/account")({
  component: Account,
});

const STATUS_COPY: Record<
  AccountStatus,
  { title: string; body: string; tone: string; icon: typeof IconClock }
> = {
  pending: {
    title: "Awaiting approval",
    body: "Your registration has been received. An administrator will review it once your payment has been confirmed.",
    tone: "bg-secondary text-secondary-foreground",
    icon: IconClock,
  },
  confirmed: {
    title: "Registration confirmed",
    body: "Your place at the Golden Jubilee is confirmed. We look forward to seeing you.",
    tone: "bg-accent/20 text-accent-foreground",
    icon: IconCircleCheck,
  },
  cancelled: {
    title: "Registration cancelled",
    body: "This registration has been cancelled. Contact the committee if you believe this is a mistake.",
    tone: "bg-destructive/10 text-destructive",
    icon: IconCircleX,
  },
};

const PAYMENT_COPY: Record<PaymentStatus, string> = {
  unpaid: "Awaiting payment",
  completed: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function Account() {
  const navigate = useNavigate();
  const session = useSession();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [startingPayment, setStartingPayment] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const alumna = session.alumna;

  useEffect(() => {
    if (!alumna) return;
    setFullName(alumna.full_name);
    setPhone(alumna.phone_number);
  }, [alumna]);

  // Bounce signed-out visitors, including while the cookie is still being
  // checked. navigate(), not redirect(): redirect() must be thrown by a loader.
  useEffect(() => {
    if (!session.isLoading && !session.isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [session.isLoading, session.isAuthenticated, navigate]);

  const loadPayments = useCallback(async (signal?: AbortSignal) => {
    setLoadingPayments(true);
    try {
      setPayments(await api.myPayments(signal));
      setPaymentsError(null);
    } catch (caught) {
      if (signal?.aborted) return;
      setPaymentsError(
        caught instanceof ApiError ? caught.detail : "Could not load payments.",
      );
    } finally {
      if (!signal?.aborted) setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    if (!session.isAuthenticated) return;
    const controller = new AbortController();
    loadPayments(controller.signal);
    return () => controller.abort();
  }, [session.isAuthenticated, loadPayments]);

  async function startPayment() {
    setStartingPayment(true);
    try {
      const payment = await api.initiatePayment();
      window.location.assign(payment.gateway_url);
    } catch (caught) {
      setPaymentsError(
        caught instanceof ApiError ? caught.detail : "Could not start payment.",
      );
      setStartingPayment(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileNotice(null);
    setProfileError(null);
    setSavingProfile(true);

    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        phone_number: phone,
      });
      session.setAlumna(updated);
      setProfileNotice("Profile updated.");
    } catch (caught) {
      setProfileError(
        caught instanceof ApiError ? caught.detail : "Could not save changes.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  if (session.isLoading || !alumna) {
    return (
      <section className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading your registration...</p>
      </section>
    );
  }

  const statusCopy = STATUS_COPY[alumna.status];
  const StatusIcon = statusCopy.icon;
  const hasCompletedPayment = payments.some(
    (payment) => payment.status === "completed",
  );

  return (
    <section className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pt-32 pb-20">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">{alumna.full_name}</h1>
          <p className="text-sm text-muted-foreground">{alumna.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await session.signOut();
            await navigate({ to: "/" });
          }}
        >
          Sign out
        </Button>
      </header>

      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-lg px-4 py-3",
          statusCopy.tone,
        )}
      >
        <StatusIcon className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{statusCopy.title}</p>
          <p className="text-sm">{statusCopy.body}</p>
        </div>
      </div>

      {!hasCompletedPayment && alumna.status !== "cancelled" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3">
          <IconCreditCard className="size-5 shrink-0 text-muted-foreground" />
          <p className="flex-1 text-sm">Payment has not been completed yet.</p>
          <Button size="sm" onClick={startPayment} isDisabled={startingPayment}>
            {startingPayment ? "Opening gateway..." : "Pay now"}
          </Button>
        </div>
      )}

      <section className="rounded-lg border border-border">
        <h2 className="border-b border-border px-4 py-3 font-medium">
          Registration details
        </h2>

        <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Registration code</dt>
            <dd className="font-mono">{alumna.profile?.reg_code ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Passing year</dt>
            <dd>{alumna.profile?.batch_year ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Student ID</dt>
            <dd>{alumna.profile?.student_id || "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Academic group</dt>
            <dd className="capitalize">
              {alumna.profile?.academic_group?.replace(/_/g, " ") ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">T-shirt size</dt>
            <dd>{alumna.profile?.tee_shirt_size ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Registered on</dt>
            <dd>
              {alumna.profile ? formatDate(alumna.profile.registered_at) : "-"}
            </dd>
          </div>
          {alumna.profile?.work_profile && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Work</dt>
              <dd>
                {alumna.profile.work_profile.designation} at{" "}
                {alumna.profile.work_profile.organization_name}
              </dd>
            </div>
          )}
          {alumna.profile?.address && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Address</dt>
              <dd>
                {[
                  alumna.profile.address.street_address,
                  alumna.profile.address.city,
                  alumna.profile.address.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-border">
        <h2 className="border-b border-border px-4 py-3 font-medium">
          Payments
        </h2>

        {paymentsError ? (
          <p role="alert" className="px-4 py-4 text-sm text-destructive">
            {paymentsError}
          </p>
        ) : loadingPayments ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No payment attempts yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((payment) => (
              <li
                key={payment.uuid}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">
                    {payment.transaction_reference}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(payment.paid_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums">{payment.amount} BDT</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      payment.status === "completed"
                        ? "bg-accent/20 text-accent-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {PAYMENT_COPY[payment.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="rounded-lg border border-border" onSubmit={saveProfile}>
        <h2 className="border-b border-border px-4 py-3 font-medium">
          Contact details
        </h2>

        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="account-name"
            >
              Full name
            </label>
            <Input
              id="account-name"
              name="full_name"
              value={fullName}
              minLength={2}
              required
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="account-phone"
            >
              Phone number
            </label>
            <Input
              id="account-phone"
              name="phone_number"
              type="tel"
              value={phone}
              maxLength={16}
              required
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <Button type="submit" size="sm" isDisabled={savingProfile}>
            {savingProfile ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>

          {profileNotice && (
            <p role="status" className="text-sm text-accent-foreground">
              {profileNotice}
            </p>
          )}
          {profileError && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-sm text-destructive"
            >
              <IconAlertCircle className="size-4" />
              {profileError}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
