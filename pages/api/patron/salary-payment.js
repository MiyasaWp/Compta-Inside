import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role))
    return res.status(403).json({ error: 'Accès refusé' });

  const companyId = token.companyId;

  // Type d'entreprise
  const [companyRow] = await sql`
    SELECT COALESCE(company_type, 'cafe') AS company_type FROM companies WHERE id = ${companyId}
  `;
  const isGarage = companyRow?.company_type === 'garage';

  async function computeTotalSinceLast() {
    const [lastPayRow] = await sql`
      SELECT COALESCE(MAX(paid_at), '1970-01-01T00:00:00Z'::timestamptz) AS last_paid
      FROM salary_payments WHERE company_id = ${companyId}
    `;
    const lastPaid = lastPayRow.last_paid;

    let total = 0;

    if (isGarage) {
      // Garage : devis + ventes directes
      const [totalDevis] = await sql`
        SELECT COALESCE(SUM(GREATEST(0, gq.grand_total - COALESCE(gq.parts_total,0)) * u.salary_percent / 100), 0)::float AS total
        FROM garage_quotes gq
        JOIN users u ON u.id = gq.employee_id
        WHERE gq.company_id = ${companyId}
          AND gq.created_at > ${lastPaid}
      `;
      const [totalSales] = await sql`
        SELECT COALESCE(SUM(s.total_amount * u.salary_percent / 100), 0)::float AS total
        FROM sales s
        JOIN users u ON u.id = s.employee_id
        WHERE s.company_id = ${companyId}
          AND s.sale_date > ${lastPaid}
      `;
      total = (totalDevis.total || 0) + (totalSales.total || 0);
    } else {
      // Café : salaire = marge × salary_percent
      const [totalRow] = await sql`
        WITH avg_prices AS (
          SELECT raw_material_id,
                 SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
          FROM purchases
          WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
          GROUP BY raw_material_id
        ),
        product_costs AS (
          SELECT pr.product_id,
                 COALESCE(SUM(pr.quantity_per_unit * COALESCE(ap.avg_unit_price, 0)), 0) AS cost_price
          FROM product_recipes pr
          LEFT JOIN avg_prices ap ON ap.raw_material_id = pr.raw_material_id
          WHERE pr.company_id = ${companyId}
          GROUP BY pr.product_id
        )
        SELECT COALESCE(SUM(
          GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))
          * u.salary_percent / 100
        ), 0)::float AS total
        FROM sales s
        JOIN  users u ON u.id = s.employee_id
        LEFT JOIN product_costs pc ON pc.product_id = s.product_id
        WHERE s.company_id = ${companyId}
          AND s.sale_date  > ${lastPaid}
      `;
      total = totalRow.total;
    }

    return { total, lastPaid };
  }

  // ── GET ───────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { total, lastPaid } = await computeTotalSinceLast();

    const [lastEntry] = await sql`
      SELECT id, total_amount::float, paid_at
      FROM salary_payments
      WHERE company_id = ${companyId}
      ORDER BY paid_at DESC LIMIT 1
    `;

    const history = await sql`
      SELECT sp.id, sp.week_start, sp.total_amount::float, sp.paid_at,
             u.name AS paid_by_name
      FROM salary_payments sp
      LEFT JOIN users u ON u.id = sp.paid_by
      WHERE sp.company_id = ${companyId}
      ORDER BY sp.paid_at DESC LIMIT 10
    `;

    return res.status(200).json({
      lastPaid,
      isPaid:     total <= 0 && !!lastEntry,
      paidAt:     lastEntry?.paid_at    ?? null,
      paidAmount: lastEntry?.total_amount ?? null,
      totalToPay: total,
      history,
    });
  }

  // ── POST : payer ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const { total, lastPaid } = await computeTotalSinceLast();

    if (total <= 0)
      return res.status(400).json({ error: 'Aucun salaire accumulé depuis le dernier paiement.' });

    // Anti-double-clic : bloquer si un paiement a été effectué dans les 5 dernières secondes
    const [recentPayment] = await sql`
      SELECT id FROM salary_payments
      WHERE company_id = ${companyId}
        AND paid_at > NOW() - INTERVAL '5 seconds'
    `;
    if (recentPayment) {
      return res.status(409).json({ error: 'Un paiement vient d\'être effectué. Veuillez patienter quelques secondes.' });
    }

    // Libellé = lundi de la semaine en cours (pour le regroupement historique)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Chaque paiement crée sa propre ligne (plus d'accumulation ON CONFLICT)
    // Nécessite la migration schema_v17.sql (suppression de la contrainte UNIQUE)
    await sql`
      INSERT INTO salary_payments (company_id, week_start, total_amount, paid_by)
      VALUES (${companyId}, ${weekStartStr}, ${total}, ${parseInt(token.sub)})
    `;

    return res.status(200).json({ ok: true, total });
  }

  return res.status(405).end();
}
