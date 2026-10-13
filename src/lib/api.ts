/**
 * Typed client for the MPSC 50 Years API. Auth is an httpOnly cookie, so every
 * request sends credentials. ApiError normalises FastAPI's two error shapes.
 */

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;
  /** Always a human-readable string, even for 422 validation payloads. */
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function extractDetail(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;

    if (typeof detail === "string") return detail;

    // Pydantic 422: surface the first message, not the whole array.
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first.msg === "string") return first.msg;
    }
  }

  return fallback;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      // Required: the access token lives in an httpOnly cookie, not a header.
      credentials: "include",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch {
    // fetch only rejects on a network-level failure.
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractDetail(parsed, response.statusText),
    );
  }

  return parsed as T;
}

// --- Types, mirroring the API's response models ---------------------------

export type AccountStatus = "pending" | "confirmed" | "cancelled";
export type PaymentStatus =
  | "unpaid"
  | "completed"
  | "refunded"
  | "failed"
  | "cancelled";

export type AcademicGroup = "science" | "humanities" | "business_studies";
export type TeeShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";

export type WorkProfile = {
  organization_name: string;
  designation: string;
  department_or_division: string;
};

export type Address = {
  street_address: string;
  city: string;
  state_or_province: string;
  postal_code: string;
  country: string;
};

export type Acquaintance = {
  full_name: string;
  relation: string;
  age_group: "adult" | "child";
};

export type PaymentSummary = {
  has_paid: boolean;
  latest_status: PaymentStatus;
  amount: number | null;
  transaction_reference: string | null;
  paid_at: string | null;
};

export type Alumna = {
  uuid: string;
  full_name: string;
  email: string;
  phone_number: string;
  status: AccountStatus;
  created_at: string;
  profile: {
    uuid: string;
    reg_code: string;
    student_id: string | null;
    batch_year: number;
    tee_shirt_size: string;
    academic_group: string | null;
    registered_at: string;
    work_profile: WorkProfile | null;
    address: Address | null;
  } | null;
  payment: PaymentSummary;
  acquaintances: Acquaintance[];
};

export type EventInformation = {
  name: string;
  subtitle: string;
  established_year: number;
  celebration_year: number;
  registration_deadline: string;
  event_date: string;
  venue: string;
  participation_fee_bdt: number;
};

export type PublicStatistics = {
  confirmed_alumnae: number;
  total_registrations: number;
  batch_years_covered: number;
};

export type PaymentSession = {
  transaction_reference: string;
  gateway_url: string;
  session_key: string;
};

export type RegistrationInput = {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  batch_year: number;
  tee_shirt_size: TeeShirtSize;
  academic_group?: AcademicGroup;
  student_id?: string;
  work_profile?: WorkProfile;
  address?: Address;
  acquaintances?: Acquaintance[];
};

export type Payment = {
  uuid: string;
  amount: number;
  transaction_reference: string;
  status: PaymentStatus;
  paid_at: string;
};

export type UpdateProfileInput = {
  full_name?: string;
  phone_number?: string;
};

// --- Endpoints ------------------------------------------------------------

export const api = {
  // Registration responds 201 and sets the access cookie, so the caller can go
  // straight to payments.initiate without logging in.
  register: (input: RegistrationInput) =>
    request<Alumna>("/auth/register", { method: "POST", body: input }),

  login: (email: string, password: string) =>
    request<Alumna>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),

  // Used to recover a session after a token expiry without forcing a re-login.
  refreshToken: () =>
    request<{ access_token: string; token_type: string }>(
      "/auth/refresh-token",
      { method: "POST" },
    ),

  me: (signal?: AbortSignal) =>
    request<Alumna>("/auth/me", signal ? { signal } : {}),

  updateProfile: (input: UpdateProfileInput) =>
    request<Alumna>("/auth/update-profile", {
      method: "PUT",
      body: input,
    }),

  myPayments: (signal?: AbortSignal) =>
    request<Payment[]>("/payments/me", signal ? { signal } : {}),

  eventInformation: (signal?: AbortSignal) =>
    request<EventInformation>("/public/event", signal ? { signal } : {}),

  statistics: (signal?: AbortSignal) =>
    request<PublicStatistics>("/public/statistics", signal ? { signal } : {}),

  initiatePayment: () =>
    request<PaymentSession>("/payments/initiate", { method: "POST" }),

  // --- admin ---

  adminLogin: (adminSecret: string) =>
    request<{ message: string; expires_in: number }>("/admin/login", {
      method: "POST",
      body: { admin_secret: adminSecret },
    }),

  adminLogout: () =>
    request<{ message: string }>("/admin/logout", { method: "POST" }),

  adminSession: (signal?: AbortSignal) =>
    request<{ authenticated: boolean }>(
      "/admin/session",
      signal ? { signal } : {},
    ),

  adminAlumnae: (
    filter?: { status?: AccountStatus; limit?: number; offset?: number },
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    if (filter?.limit) params.set("limit", String(filter.limit));
    if (filter?.offset) params.set("offset", String(filter.offset));
    const query = params.toString();

    return request<Alumna[]>(
      `/admin/alumnae${query ? `?${query}` : ""}`,
      signal ? { signal } : {},
    );
  },

  adminCounts: (signal?: AbortSignal) =>
    request<Record<AccountStatus, number>>(
      "/admin/alumnae/counts",
      signal ? { signal } : {},
    ),

  adminUpdateStatus: (uuid: string, newStatus: AccountStatus) =>
    request<Alumna>(`/admin/alumnae/${uuid}/status?new_status=${newStatus}`, {
      method: "PATCH",
    }),
};
