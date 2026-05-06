import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const companyId  = token.companyId;
  const employeeId = token.id;
  if (!companyId) return res.status(403).json({ error: 'Pas de company_id' });

  // ── GET : liste des devis ────────────────────────────────────────
  if (req.method === 'GET') {
    const quotes = await sql`
      SELECT gq.*, u.name AS employee_name
      FROM garage_quotes gq
      LEFT JOIN users u ON u.id = gq.employee_id
      WHERE gq.company_id = ${companyId}
      ORDER BY gq.created_at DESC
      LIMIT 200
    `;
    return res.status(200).json({ quotes });
  }

  // ── POST : créer un devis ────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      clientFirstName, clientLastName, vehicleModel, vehicleCategory,
      selectedPerformances, selectedCustoms, selectedPaints,
      perfsTotal, customsTotal, paintsTotal, grandTotal, partsTotal, notes,
    } = req.body;

    const parts = parseFloat(partsTotal) || 0;
    const grand = parseFloat(grandTotal) || 0;

    // Insérer le devis
    const [quote] = await sql`
      INSERT INTO garage_quotes (
        company_id, employee_id,
        client_first_name, client_last_name, vehicle_model, vehicle_category,
        selected_performances, selected_customs, selected_paints,
        perfs_total, customs_total, paints_total, grand_total, parts_total, notes
      ) VALUES (
        ${companyId}, ${employeeId},
        ${clientFirstName || ''}, ${clientLastName || ''},
        ${vehicleModel || ''}, ${vehicleCategory || ''},
        ${JSON.stringify(selectedPerformances || [])},
        ${JSON.stringify(selectedCustoms || [])},
        ${JSON.stringify(selectedPaints || [])},
        ${perfsTotal || 0}, ${customsTotal || 0}, ${paintsTotal || 0},
        ${grand}, ${parts}, ${notes || null}
      )
      RETURNING *
    `;

    // Déduire le coût des pièces du solde bancaire automatiquement
    if (parts > 0) {
      await sql`
        UPDATE companies
        SET account_balance = COALESCE(account_balance, 0) - ${parts}
        WHERE id = ${companyId}
      `;
    }

    return res.status(201).json({ quote });
  }

  // ── DELETE : supprimer un devis ──────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id manquant' });

    if (!['patron', 'admin'].includes(token.role))
      return res.status(403).json({ error: 'Accès refusé' });

    // Récupérer parts_total pour rembourser le solde
    const [existing] = await sql`
      SELECT parts_total::float FROM garage_quotes
      WHERE id = ${parseInt(id)} AND company_id = ${companyId}
    `;

    const [deleted] = await sql`
      DELETE FROM garage_quotes
      WHERE id = ${parseInt(id)} AND company_id = ${companyId}
      RETURNING id
    `;
    if (!deleted) return res.status(404).json({ error: 'Devis introuvable' });

    // Rembourser les pièces au solde si suppression
    if (existing?.parts_total > 0) {
      await sql`
        UPDATE companies
        SET account_balance = COALESCE(account_balance, 0) + ${existing.parts_total}
        WHERE id = ${companyId}
      `;
    }

    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
}
