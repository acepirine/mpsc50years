import { IconCircleX } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export const Route = createFileRoute("/payment/cancelled")({
  component: PaymentCancelled,
});

function PaymentCancelled() {
  const [retrying, setRetrying] = useState(false);

  // The API appends ?reason=... to this URL to explain the failure.
  const [reason] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("reason");
    return value ? decodeURIComponent(value) : null;
  });

  async function retry() {
    setRetrying(true);
    try {
      const session = await api.initiatePayment();
      window.location.assign(session.gateway_url);
    } catch {
      setRetrying(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 pt-40 pb-20 text-center">
      <IconCircleX className="size-16 text-destructive" stroke={1.5} />

      <div className="flex flex-col gap-3">
        <h1>Payment not completed</h1>
        <p className="text-muted-foreground">
          Your payment was cancelled, so nothing has been charged. Your
          registration is still saved and you can pay whenever you are ready.
        </p>
        {reason && reason !== "missing_reference" && (
          <p className="text-sm text-muted-foreground">
            Reason reported by the gateway: {reason}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={retry} isDisabled={retrying}>
          {retrying ? "Opening gateway..." : "Try payment again"}
        </Button>
        <Button variant="outline" onClick={() => window.location.assign("/")}>
          Back to home
        </Button>
      </div>
    </section>
  );
}
