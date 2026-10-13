import { IconLock } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

// The trailing underscore in the filename opts this route out of the /admin
// parent. Without it this form nests inside the panel and never renders.
export const Route = createFileRoute("/admin_/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.adminLogin(secret);
      // navigate(), not redirect(): redirect() must be thrown by a loader.
      await navigate({ to: "/admin", replace: true });
      setSubmitting(false);
      setSubmitting(false);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
          : "Sign in failed. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <section className="flex min-h-screen items-center justify-center px-4 pt-40 pb-20">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 pb-8 text-center">
          <IconLock className="size-8 text-accent" stroke={1.5} />
          <h1 className="text-2xl">Admin sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter the admin secret to review registrations.
          </p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="admin-secret"
            >
              Admin secret
            </label>
            <Input
              id="admin-secret"
              name="admin_secret"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              placeholder="••••••••••••"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" isDisabled={submitting || secret.length === 0}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </section>
  );
}
