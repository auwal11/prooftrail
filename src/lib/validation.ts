import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200, "Password is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const caseCreateSchema = z.object({
  title: z.string().trim().min(3, "Give the case a short title.").max(140),
  serviceType: z.enum(["AIRTIME", "DATA", "OTHER"]),
  provider: optionalText(80),
  claimedAmount: z
    .number()
    .min(0.01, "Amount must be greater than zero.")
    .max(1_000_000_000, "Amount is too large.")
    .optional(),
  incidentDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  transactionReference: optionalText(80),
  customerPhone: optionalText(30),
  description: optionalText(2000),
});

export const caseUpdateSchema = caseCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "EVIDENCE_REVIEW", "READY", "CLOSED"]).optional(),
});

export const revisionSchema = z.object({
  action: z.enum(["CORRECT", "REJECT", "RESTORE"]),
  newValue: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export function normalizePhone(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^\d+]/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^\+234[789][01]\d{8}$/.test(digits)) return digits;
  if (/^234[789][01]\d{8}$/.test(digits)) return `+${digits}`;
  return value.trim();
}

export function normalizeReference(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase() || undefined;
}
