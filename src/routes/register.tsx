import {
  IconAlertCircle,
  IconLoader2,
  IconMail,
  IconMapPin,
  IconPhone,
} from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AcademicGroup,
  ApiError,
  api,
  type TeeShirtSize,
} from "@/lib/api";
import {
  ACADEMIC_GROUPS,
  readForm,
  TEE_SHIRT_SIZES,
  toPayload,
} from "@/lib/registration";

export const Route = createFileRoute("/register")({
  component: RouteComponent,
});

const inputClass = "h-8 w-full text-sm";
const groupClass = "h-8 rounded-md";

function Field({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5 pb-2">
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            Optional
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-3.5">
      <div className="space-y-1">
        <h2 className="pb-4">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </fieldset>
  );
}

function RouteComponent() {
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Account exists but payment did not start. Registration is not rolled back,
  // so the form must not offer a resubmit the API would reject as duplicate.
  const [registered, setRegistered] = useState(false);
  const [startingPayment, setStartingPayment] = useState(false);

  // Controlled selects, read from state rather than the form.
  const [teeShirtSize, setTeeShirtSize] = useState<TeeShirtSize | null>(null);
  const [academicGroup, setAcademicGroup] = useState<AcademicGroup | null>(
    null,
  );

  async function startPayment() {
    // The API decides where the gateway is; we only follow its redirect.
    const session = await api.initiatePayment();
    window.location.assign(session.gateway_url);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setError(null);
    setSubmitting(true);

    try {
      await api.register(
        toPayload(readForm(form), { teeShirtSize, academicGroup }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
          : "Registration failed. Please try again.",
      );
      setSubmitting(false);
      return;
    }

    // Registration sets the session cookie, so payment can start immediately.
    setRegistered(true);
    setSubmitting(false);
    setStartingPayment(true);

    try {
      await startPayment();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
          : "Could not reach the payment gateway.",
      );
      setStartingPayment(false);
    }
  }

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 pt-40 pb-20">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormSection title="Personal Information">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Full Name" htmlFor="full-name">
              <Input
                id="full-name"
                name="full_name"
                placeholder="Your full name"
                className={inputClass}
                required
              />
            </Field>

            <Field label="Phone Number" htmlFor="phone">
              <InputGroup className={groupClass}>
                <InputGroupAddon>
                  <InputGroupText>
                    <IconPhone className="size-3.5" />
                    +880
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="phone"
                  name="phone_number"
                  type="tel"
                  placeholder="1XXX-XXXXXX"
                  required
                />
              </InputGroup>
            </Field>

            <Field label="Email Address" htmlFor="email">
              <InputGroup className={groupClass}>
                <InputGroupAddon>
                  <InputGroupText>
                    <IconMail className="size-3.5" />
                  </InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </InputGroup>
            </Field>

            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                minLength={8}
                className={inputClass}
                required
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Alumni Verification"
          description="Provide your academic details to help identify your records."
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Student ID" htmlFor="student-id" optional>
              <Input
                id="student-id"
                name="student_id"
                placeholder="Student ID"
                className={inputClass}
              />
            </Field>

            <Field label="Passing Year" htmlFor="passing-year">
              <InputGroup className={groupClass}>
                <InputGroupInput
                  id="passing-year"
                  name="batch_year"
                  placeholder="e.g. 2018"
                  inputMode="numeric"
                  maxLength={4}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>Year</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <Field label="Academic Group" htmlFor="academic-group">
              {/* `id` and not `value`: react-aria derives a SelectItem's
                  collection key from `id`, and `value` is ignored for that
                  purpose. With `value` the key becomes `react-aria-1`, which is
                  what selectedKey/onSelectionChange hand back. */}
              <Select
                selectedKey={academicGroup}
                onSelectionChange={(key) =>
                  setAcademicGroup(key as AcademicGroup | null)
                }
                className="w-full"
              >
                <SelectTrigger
                  id="academic-group"
                  className={`${inputClass} w-full`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_GROUPS.map(({ value, label }) => (
                    <SelectItem key={value} id={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Participation"
          description="We use this to prepare your event kit."
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="T-Shirt Size" htmlFor="tee-shirt-size">
              <Select
                selectedKey={teeShirtSize}
                onSelectionChange={(key) =>
                  setTeeShirtSize(key as TeeShirtSize | null)
                }
                isRequired
                className="w-full"
              >
                <SelectTrigger
                  id="tee-shirt-size"
                  className={`${inputClass} w-full`}
                >
                  <SelectValue>
                    {({ isPlaceholder }) =>
                      isPlaceholder ? "Select a size" : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TEE_SHIRT_SIZES.map((size) => (
                    <SelectItem key={size} id={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Work Profile"
          description="Your professional details, if applicable."
        >
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Organization Name" htmlFor="organization" optional>
              <Input
                id="organization"
                name="organization_name"
                placeholder="Company or organization"
                className={inputClass}
              />
            </Field>

            <Field label="Division / Department" htmlFor="department" optional>
              <Input
                id="department"
                name="department_or_division"
                placeholder="e.g. Engineering"
                className={inputClass}
              />
            </Field>

            <Field label="Designation" htmlFor="designation" optional>
              <Input
                id="designation"
                name="designation"
                placeholder="e.g. Software Engineer"
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Address">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Street Address" htmlFor="street-address">
                <InputGroup className={`${groupClass} w-full`}>
                  <InputGroupAddon>
                    <IconMapPin className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="street-address"
                    name="street_address"
                    placeholder="House, road, and street"
                  />
                </InputGroup>
              </Field>
            </div>

            <Field label="City" htmlFor="city">
              <Input
                id="city"
                name="city"
                placeholder="City"
                className={inputClass}
              />
            </Field>

            <Field label="State / Province" htmlFor="state">
              <Input
                id="state"
                name="state_or_province"
                placeholder="State or province"
                className={inputClass}
              />
            </Field>

            <Field label="Postal Code" htmlFor="postal-code">
              <Input
                id="postal-code"
                name="postal_code"
                placeholder="Postal code"
                className={inputClass}
              />
            </Field>

            <Field label="Country" htmlFor="country">
              <Input
                id="country"
                name="country"
                placeholder="Country"
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        {registered && (
          <p
            role="status"
            className="rounded-lg bg-accent/20 px-3 py-2 text-sm text-accent-foreground"
          >
            Your registration is saved. Payment still needs to be completed.
          </p>
        )}

        <div className="flex flex-col items-center gap-3 pt-4">
          {registered ? (
            <Button
              type="button"
              onClick={startPayment}
              isDisabled={startingPayment}
              className="h-9 px-6 text-base"
            >
              {startingPayment ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Opening payment gateway...
                </>
              ) : (
                "Retry payment"
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              isDisabled={submitting}
              className="h-9 px-6 text-base"
            >
              {submitting ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Creating your account...
                </>
              ) : (
                "Register and pay 1500 BDT"
              )}
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {registered
              ? "Your account is created. Complete the payment to finish registering for the event."
              : "You will be taken to the payment gateway to complete your registration."}
          </p>
          {registered && (
            <button
              type="button"
              className="cursor-pointer text-xs text-muted-foreground underline"
              onClick={() => navigate({ to: "/" })}
            >
              Back to home
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
