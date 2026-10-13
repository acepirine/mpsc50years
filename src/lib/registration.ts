/**
 * Registration form data: field lists, FormData reading, and payload building.
 *
 * Kept out of the route so the mapping to the API's shape is readable and
 * testable on its own.
 */
import {
  type AcademicGroup,
  ApiError,
  type RegistrationInput,
  type TeeShirtSize,
} from "@/lib/api";

export const ACADEMIC_GROUPS: { value: AcademicGroup; label: string }[] = [
  { value: "science", label: "Science" },
  { value: "humanities", label: "Humanities" },
  { value: "business_studies", label: "Business Studies" },
];

export const TEE_SHIRT_SIZES: TeeShirtSize[] = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

export type Selections = {
  teeShirtSize: TeeShirtSize | null;
  academicGroup: AcademicGroup | null;
};

/**
 * Read the text inputs via FormData. The Selects are excluded: react-aria
 * submits them as a hidden <select> of generated keys (`react-aria-1`, ...),
 * not the value set on each SelectItem, so they are read from state instead.
 */
export function readForm(form: HTMLFormElement) {
  const data = new FormData(form);
  const value = (key: string) => {
    const raw = data.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };

  return {
    // The +880 prefix is decoration, so it never reaches FormData.
    fullName: value("full_name"),
    phoneNumber: `+880${value("phone_number").replace(/^\+/, "")}`,
    email: value("email"),
    password: value("password"),
    studentId: value("student_id"),
    batchYear: value("batch_year"),
    organization: value("organization_name"),
    department: value("department_or_division"),
    designation: value("designation"),
    streetAddress: value("street_address"),
    city: value("city"),
    state: value("state_or_province"),
    postalCode: value("postal_code"),
    country: value("country"),
  };
}

type Fields = ReturnType<typeof readForm>;

/** Build the API payload, omitting optional blocks the alumna left blank. */
export function toPayload(
  fields: Fields,
  selections: Selections,
): RegistrationInput {
  const batchYear = Number.parseInt(fields.batchYear, 10);

  if (!Number.isFinite(batchYear)) {
    throw new ApiError(0, "Passing year must be a number.");
  }

  // Checked here: the API's reply is a raw enum list, useless to a form filler.
  if (!selections.teeShirtSize) {
    throw new ApiError(0, "Please choose your T-shirt size.");
  }

  const workProfile =
    fields.organization && fields.designation && fields.department
      ? {
          organization_name: fields.organization,
          designation: fields.designation,
          department_or_division: fields.department,
        }
      : null;

  const address =
    fields.streetAddress && fields.city && fields.country
      ? {
          street_address: fields.streetAddress,
          city: fields.city,
          state_or_province: fields.state,
          postal_code: fields.postalCode,
          country: fields.country,
        }
      : null;

  return {
    full_name: fields.fullName,
    email: fields.email,
    phone_number: fields.phoneNumber,
    password: fields.password,
    batch_year: batchYear,
    tee_shirt_size: selections.teeShirtSize,
    ...(selections.academicGroup
      ? { academic_group: selections.academicGroup }
      : {}),
    ...(fields.studentId ? { student_id: fields.studentId } : {}),
    // Only send nested blocks when filled; the API would store blanks.
    ...(workProfile ? { work_profile: workProfile } : {}),
    ...(address ? { address } : {}),
  };
}
