# mpsc50years

This repository contains the web based system for the 50 years celebrations event.

The system offers,

1. Authentication & Authorization for Alumni
2. Payment via SSLCommerz
3. Information displayed via public facing pages
4. An admin panel for reviewing and approving registrations

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL to the API's public origin
npm run dev            # http://localhost:3000
```

The API must be running and reachable, since every request goes to it. See the
backend repository (`mpsc50yapi`) for its own setup.

```bash
npm run build          # production build
npx tsr generate       # regenerate the route tree after adding routes
npx biome check        # lint and format
npx tsc --noEmit       # type check
```

The project uses pnpm; `pnpm-lock.yaml` is the lockfile of record.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Landing page, countdown, participation steps |
| `/faq` | Frequently asked questions |
| `/register` | Registration form; submits, then redirects to the payment gateway |
| `/login` | Alumna sign in |
| `/account` | Signed-in area: status, registration details, payments, contact edit |
| `/payment/success` | Where the API redirects after validating a payment |
| `/payment/cancelled` | Where the API redirects when payment is abandoned |
| `/admin/login` | Admin sign in |
| `/admin` | Registration review table |

`/admin/login` is defined in `admin_.login.tsx`. The trailing underscore opts
the route out of the `/admin` parent defined in `admin.tsx`; without it,
file-based routing nests the login form under the panel, which renders
`AdminPanel` first and hangs on "Checking session...".

## How registration works

The form builds a payload in the API's snake_case shape, nesting the optional
work profile and address blocks and omitting them entirely when left blank —
the API treats an all-empty block as a real record. Submitting calls
`POST /auth/register`, which sets the session cookie, then immediately calls
`POST /payments/initiate` and follows the gateway URL the API returns.

If registration succeeds but payment cannot start, the account is already
created, so the form switches to a "retry payment" state instead of inviting a
second submission that the API would reject as a duplicate email.

The `+880` prefix shown in the phone field is decoration and never reaches the
form data, so it is reattached before sending.

The two selects are controlled and read from React state rather than the form.
react-aria submits a `Select` through a hidden `<select>` whose option values
are its internal collection keys (`react-aria-1`, ...), and the key comes from
`id` on `SelectItem`, not `value`.

## Signing in

`/login` posts credentials to `POST /auth/login`, which sets the access cookie.
`/account` resolves that cookie on load and redirects to `/login` when it is
missing or expired, so a bookmarked `/account` link behaves sensibly.

`useSession` in `src/lib/use-session.ts` wraps the session so the navbar and the
account page agree on whether anyone is signed in. A 401 from `/auth/me` is the
expected answer for a signed-out visitor, so it resolves to `anonymous` rather
than being reported as an error; any other failure is surfaced separately so a
broken API is not mistaken for being logged out.

Wrong email and wrong password are reported identically, so the form does not
reveal which addresses are registered.

A `pending` alumna can sign in and pay — approval is the final step, not a
precondition for an account.

## Admin panel

`/admin` checks the admin session cookie on load and redirects to
`/admin/login` when it is missing or expired. The table lists alumnae with a
payment summary, filterable by status tab and searchable by name, email, phone
or registration code. Approving applies immediately; cancelling asks for
confirmation first, since that is the expensive mistake to undo.

Admin credentials are never stored in the browser: `POST /admin/login` exchanges
the shared secret for an httpOnly cookie. The secret is held in component state
only for the request that submits it.

Search is client-side over the fetched page, and the listing requests
`limit=200`. That is fine at event scale; neither is a substitute for
server-side search once the list grows.

Author:  Docufy <info@docufybd.com>

License: See [License](./LICENSE) file.
