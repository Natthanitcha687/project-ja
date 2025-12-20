import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();
const isoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date format",
  });

export const registerCustomerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isConsent: z.boolean().default(false),
});

export const registerStoreSchema = z.object({
  storeName: z.string().min(1),
  typeStore: z.string().min(1),
  ownerStore: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  address: z.string().min(1),
  timeAvailable: z.string().min(1),
  password: z.string().min(8),
  isConsent: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const emailOnlySchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

export const updateStoreProfileSchema = z
  .object({
    storeName: z.string().min(1, "Store name is required"),
    contactName: optionalString.or(z.null()).optional(),
    email: z.string().email().optional().or(z.literal("")).or(z.null()),
    phone: z.string().min(6, "Phone number is too short"),
    address: z.string().min(1, "Address is required"),
    businessHours: optionalString.or(z.null()).optional(),
    avatarUrl: optionalString.or(z.null()).optional(),
    storeType: optionalString.or(z.null()).optional(),
    ownerName: optionalString.or(z.null()).optional(),
    notifyDaysInAdvance: z.coerce.number().int().min(1).max(90).optional(),
  })
  .strict();

export const changePasswordSchema = z.object({
  old_password: z.string().min(6, "Current password is required"),
  new_password: z
    .string()
    .min(8, "New password must be at least 8 characters"),
});

export const createWarrantySchema = z.object({
  customer_email: z.string().email(),
  customer_name: optionalString.or(z.null()).optional(),
  customer_phone: optionalString.or(z.null()).optional(),
  product_name: z.string().min(1, "Product name is required"),
  // ⬇️ เพิ่มช่องรุ่น (Model)
  model: optionalString.or(z.null()).optional(),
  serial: optionalString.or(z.null()).optional(),
  purchase_date: isoDateString,
  expiry_date: isoDateString.optional(),
  duration_months: z.coerce.number().int().positive().optional(),
  warranty_terms: z.string().min(1, "Warranty terms are required"),
  note: z.string().optional().or(z.literal("")).or(z.null()),
});

export const updateWarrantySchema = createWarrantySchema.partial();
