-- Add original_price column to cache branded alternatives for ingredients
ALTER TABLE ingredients ADD COLUMN original_price integer;
