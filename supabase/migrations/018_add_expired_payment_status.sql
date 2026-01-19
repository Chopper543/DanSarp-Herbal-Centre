-- Migration: Add expired status to payment_status enum
-- This allows us to mark payments that timed out without deleting them
-- Payments are marked as expired after 1 hour if no confirmation is received

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';
