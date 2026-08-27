-- Add dietary_tags column to recipes table
-- Dietary tags like 'vegetarian', 'vegan', 'gluten-free', 'nut-free', etc.

ALTER TABLE recipes
ADD COLUMN dietary_tags text[] DEFAULT '{}' NOT NULL;

-- Create an index for efficient filtering
CREATE INDEX idx_recipes_dietary_tags ON recipes USING gin(dietary_tags);

COMMENT ON COLUMN recipes.dietary_tags IS 'Array of dietary tags (e.g., vegetarian, vegan, gluten-free, nut-free, dairy-free, egg-free)';
