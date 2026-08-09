-- Add fulfillment settings to houses table
ALTER TABLE houses ADD COLUMN fulfillment_method text NOT NULL DEFAULT 'collect' CHECK (fulfillment_method IN ('collect', 'delivery'));
ALTER TABLE houses ADD COLUMN delivery_postcode text;
ALTER TABLE houses ADD COLUMN click_collect_store text NOT NULL DEFAULT 'coventry cannon park rear car park 1';
