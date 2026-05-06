-- v16 : Coût d'usine des pièces sur les devis garage
ALTER TABLE garage_quotes ADD COLUMN IF NOT EXISTS parts_total NUMERIC(12,2) DEFAULT 0;
