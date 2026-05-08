import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

// Auto-migration : ajoute unit_price si la colonne n'existe pas encore
async function ensureUnitPriceColumn() {
  try {
    await sql`ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0`;
  } catch (_) { /* ignore si déjà existe ou pas les droits */ }
}

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — liste des matières premières
  if (req.method === 'GET') {
    // Tente d'inclure unit_price ; si la colonne n'existe pas encore, retourne 0
    let materials;
    try {
      materials = await sql`
        SELECT id, name, unit, quantity::float, min_alert::float,
               COALESCE(unit_price, 0)::float AS unit_price
        FROM raw_materials
        WHERE company_id = ${companyId}
        ORDER BY name ASC
      `;
    } catch (_) {
      // Fallback sans unit_price
      const rows = await sql`
        SELECT id, name, unit, quantity::float, min_alert::float
        FROM raw_materials
        WHERE company_id = ${companyId}
        ORDER BY name ASC
      `;
      materials = rows.map(r => ({ ...r, unit_price: 0 }));
    }
    return res.status(200).json(materials);
  }

  // POST — ajouter une matière première
  if (req.method === 'POST') {
    const { name, unit, quantity, min_alert, unit_price } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom obligatoire.' });

    await ensureUnitPriceColumn();

    let m;
    try {
      [m] = await sql`
        INSERT INTO raw_materials (company_id, name, unit, quantity, min_alert, unit_price)
        VALUES (
          ${companyId}, ${name}, ${unit || 'unité'},
          ${parseFloat(quantity) || 0}, ${parseFloat(min_alert) || 5},
          ${parseFloat(unit_price) || 0}
        )
        RETURNING id, name, unit, quantity::float, min_alert::float,
                  COALESCE(unit_price, 0)::float AS unit_price
      `;
    } catch (_) {
      // Fallback si unit_price n'existe toujours pas
      [m] = await sql`
        INSERT INTO raw_materials (company_id, name, unit, quantity, min_alert)
        VALUES (
          ${companyId}, ${name}, ${unit || 'unité'},
          ${parseFloat(quantity) || 0}, ${parseFloat(min_alert) || 5}
        )
        RETURNING id, name, unit, quantity::float, min_alert::float
      `;
      m = { ...m, unit_price: 0 };
    }

    return res.status(201).json(m);
  }

  // PUT — modifier (nom, unité, seuil, prix unitaire) ou ajuster le stock
  if (req.method === 'PUT') {
    const { id, name, unit, quantity, min_alert, unit_price } = req.body;

    try {
      await ensureUnitPriceColumn();
      await sql`
        UPDATE raw_materials
        SET name       = COALESCE(${name ?? null}, name),
            unit       = COALESCE(${unit ?? null}, unit),
            quantity   = COALESCE(${quantity   !== undefined ? parseFloat(quantity)   : null}::numeric, quantity),
            min_alert  = COALESCE(${min_alert  !== undefined ? parseFloat(min_alert)  : null}::numeric, min_alert),
            unit_price = COALESCE(${unit_price !== undefined ? parseFloat(unit_price) : null}::numeric, unit_price)
        WHERE id = ${id} AND company_id = ${companyId}
      `;
    } catch (_) {
      // Fallback sans unit_price
      await sql`
        UPDATE raw_materials
        SET name      = COALESCE(${name ?? null}, name),
            unit      = COALESCE(${unit ?? null}, unit),
            quantity  = COALESCE(${quantity  !== undefined ? parseFloat(quantity)  : null}::numeric, quantity),
            min_alert = COALESCE(${min_alert !== undefined ? parseFloat(min_alert) : null}::numeric, min_alert)
        WHERE id = ${id} AND company_id = ${companyId}
      `;
    }

    return res.status(200).json({ success: true });
  }

  // DELETE — supprimer une matière première
  if (req.method === 'DELETE') {
    const { id } = req.body;
    await sql`DELETE FROM raw_materials WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
