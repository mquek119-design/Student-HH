-- Cached Tesco product image, so the basket has pictures without a second fetch.
alter table ingredients add column if not exists image_url text;
