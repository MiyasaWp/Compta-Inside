-- v18 : prix unitaire sur les matières premières
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0;
