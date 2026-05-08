import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — historique des mouvements
  if (req.method === 'GET') {
    const { raw_material_id, limit = 60 } = req.query;

    const movements = raw_material_id
      ? await sql`
          SELECT sm.id, sm.movement_type, sm.quantity_change::float,
                 sm.quantity_after::float, sm.reference_id, sm.reference_label,
                 sm.created_at,
                 rm.name AS material_name, rm.unit AS material_unit
          FROM stock_movements sm
          JOIN raw_materials rm ON rm.id = sm.raw_material_id
          WHERE sm.company_id = ${companyId}
            AND sm.raw_material_id = ${parseInt(raw_material_id)}
          ORDER BY sm.created_at DESC
          LIMIT ${parseInt(limit)}
        `
      : await sql`
          SELECT sm.id, sm.movement_type, sm.quantity_change::float,
                 sm.quantity_after::float, sm.reference_id, sm.reference_label,
                 sm.created_at,
                 rm.name AS material_name, rm.unit AS material_unit
          FROM stock_movements sm
          JOIN raw_materials rm ON rm.id = sm.raw_material_id
          WHERE sm.company_id = ${companyId}
          ORDER BY sm.created_at DESC
          LIMIT ${parseInt(limit)}
        `;

    return res.status(200).json(movements);
  }

  // POST — ajout de stock SANS achat (stock initial, stock donné, correction positive)
  // Ne crée pas de purchase → pas de débit du solde.
  if (req.method === 'POST') {
    const { raw_material_id, quantity, label } = req.body;

    if (!raw_material_id || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ error: 'Matière première et quantité obligatoires.' });
    }

    const [rm] = await sql`
      SELECT id FROM raw_materials
      WHERE id = ${parseInt(raw_material_id)} AND company_id = ${companyId}
    `;
    if (!rm) return res.status(404).json({ error: 'Matière première introuvable.' });

    const qty = parseFloat(quantity);

    const [updated] = await sql`
      UPDATE raw_materials
      SET quantity = quantity + ${qty}
      WHERE id = ${parseInt(raw_material_id)} AND company_id = ${companyId}
      RETURNING quantity::float AS new_qty
    `;

    await sql`
      INSERT INTO stock_movements
        (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_label)
      VALUES
        (${companyId}, ${parseInt(raw_material_id)}, 'initial', ${qty},
         ${updated.new_qty}, ${label || 'Stock initial / donné'})
    `;

    return res.status(201).json({ success: true, new_qty: updated.new_qty });
  }

  return res.status(405).end();
}
