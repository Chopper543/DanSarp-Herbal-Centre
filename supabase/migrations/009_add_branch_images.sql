-- Migration: Add image_urls support to branches table
-- This allows each branch to have multiple photos (2 photos per branch as requested)

-- Add image_urls column to branches table
-- Using JSONB to store an array of image URLs
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN branches.image_urls IS 'Array of image URLs for branch photos. Format: ["url1", "url2"]';
