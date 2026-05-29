-- ============================================================
--  CRÉATION DE L'ENTREPRISE AUTOSHOP + PATRON LENNY
--  Mot de passe par défaut : Patron123!
--  À exécuter dans l'éditeur SQL de Neon
-- ============================================================

-- 1. Créer l'entreprise AutoShop (type garage)
INSERT INTO companies (name, company_type)
VALUES ('AutoShop', 'garage')
ON CONFLICT DO NOTHING;

-- 2. Créer le compte patron Lenny
INSERT INTO users (name, username, email, password_hash, role, company_id, salary_percent, status)
VALUES (
  'Lenny',
  'lenny',
  'lenny@autoshop.rp',
  '$2b$12$.LsXhsVOvAmLRiKjF5ETp.L1qx4B.zsLlbbNi0o7yVkzRAxRbK5wW',
  'patron',
  (SELECT id FROM companies WHERE name = 'AutoShop' LIMIT 1),
  0,
  'active'
)
ON CONFLICT (email) DO NOTHING;

-- 3. Vérification
SELECT u.name, u.username, u.role, u.status, c.name AS entreprise, c.company_type
FROM users u
JOIN companies c ON c.id = u.company_id
WHERE c.name = 'AutoShop';
