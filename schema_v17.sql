-- v17 : Permettre plusieurs paiements de salaire par semaine/jour
-- La contrainte UNIQUE (company_id, week_start) était trop restrictive et
-- causait une accumulation incorrecte des montants via ON CONFLICT.
-- On la supprime : chaque paiement est désormais une ligne indépendante.
ALTER TABLE salary_payments
  DROP CONSTRAINT IF EXISTS salary_payments_company_id_week_start_key;
