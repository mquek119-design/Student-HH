-- Pre-swap price, so an own-brand saving can be evidenced rather than claimed.
alter table ingredients add column if not exists original_price integer;
