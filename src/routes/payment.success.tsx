import { IconCircleCheck } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api, type EventInformation } from "@/lib/api";

export const Route = createFileRoute("/payment/success")({
  component: PaymentSuccess,
});

/**
 * Where the API redirects after validating a transaction. The API settles the
 * payment first, so this page only reports the outcome.
 */
function PaymentSuccess() {
  const [event, setEvent] = useState<EventInformation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .eventInformation(controller.signal)
      .then(setEvent)
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof ApiError
            ? caught.detail
            : "Could not load event details.",
        );
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 pt-40 pb-20 text-center">
      <IconCircleCheck className="size-16 text-accent" stroke={1.5} />

      <div className="flex flex-col gap-3">
        <h1>Payment received</h1>
        <p className="text-muted-foreground">
          Thank you. Your payment has been recorded and your registration is now
          with the committee for approval.
        </p>
        <p className="text-sm text-muted-foreground">
          You will be able to sign in once an administrator approves your
          account. No further action is needed right now.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {event && (
        <dl className="grid w-full max-w-md gap-2 rounded-lg border border-border p-4 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Event</dt>
            <dd className="text-right">{event.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-right">{event.event_date}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Venue</dt>
            <dd className="text-right">{event.venue}</dd>
          </div>
        </dl>
      )}

      <Button onClick={() => window.location.assign("/")}>Back to home</Button>
    </section>
  );
}
