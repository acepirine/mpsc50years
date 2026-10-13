import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const session = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Someone already signed in has no business here. navigate(), not redirect():
  // redirect() must be thrown by a loader.
  useEffect(() => {
    if (session.isAuthenticated) {
      navigate({ to: "/account", replace: true });
    }
  }, [session.isAuthenticated, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const alumna = await api.login(email, password);
      session.setAlumna(alumna);
      await navigate({ to: "/account" });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // Never distinguish "no such email" from "wrong password" in the UI.
        setError("Incorrect email or password.");
      } else if (caught instanceof ApiError) {
        setError(caught.detail);
      } else {
        setError("Sign in failed. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 pt-40 pb-20">
      <div className="flex flex-col items-center gap-2 pb-8 text-center">
        <h1 className="text-2xl">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          View your registration and payment status.
        </p>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <label
            className="text-sm font-medium leading-none"
            htmlFor="login-email"
          >
            Email address
          </label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <label
            className="text-sm font-medium leading-none"
            htmlFor="login-password"
          >
            Password
          </label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" isDisabled={submitting || session.isLoading}>
          {submitting ? (
            <>
              <IconLoader2 className="size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="pt-6 text-center text-sm text-muted-foreground">
        Not registered yet?{" "}
        <button
          type="button"
          className="cursor-pointer underline"
          onClick={() => navigate({ to: "/register" })}
        >
          Register for the event
        </button>
      </p>
    </section>
  );
}
