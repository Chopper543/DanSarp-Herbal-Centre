import { z } from "zod";

export const AppointmentRequestSchema = z.object({
  branch_id: z.string().uuid(),
  appointment_date: z.string().datetime(),
  treatment_type: z.string().min(1, "treatment_type is required"),
  notes: z.string().optional().nullable(),
  payment_id: z.string().uuid(),
});

export const PaymentRequestSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.string().min(1).default("GHS"),
  payment_method: z.string().min(1),
  appointment_id: z.string().uuid().optional(),
  provider: z.enum(["paystack", "flutterwave", "custom"]).optional(),
  appointment_data: z.any().optional(),
  phone_number: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  bank_notes: z.string().optional(),
  // Card fields should be absent; we keep them to explicitly reject.
  card_number: z.string().optional(),
  card_expiry: z.string().optional(),
  card_name: z.string().optional(),
  card_pin: z.string().optional(),
});

export const SubscribeRequestSchema = z.object({
  email: z.string().email(),
});

export const UpdateSubscriberSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export const MessageRequestSchema = z
  .object({
    recipient_id: z.string().uuid().optional(),
    department: z.enum(["care_team", "billing", "admin"]).optional(),
    appointment_id: z.string().uuid().optional(),
    subject: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
  })
  .refine(
    (data) => Boolean(data.recipient_id) || Boolean(data.department),
    "recipient_id or department is required"
  );
