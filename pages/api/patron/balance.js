import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // ── GET : solde actuel + historique hebdomadaire ──────────────
  if (req.method === 'GET') {
    const [company] = await sql`
      SELECT account_balance::float, balance_set_at
      FROM companies WHERE id = ${companyId}
    `;

    const refBalance = company?.account_balance ?? 0;
    const refDate    = company?.balance_set_at  ?? new Date(0);

    // Type d'entreprise
    const [cRow] = await sql`SELECT COALESCE(company_type,'cafe') AS company_type FROM companies WHERE id = ${companyId}`;
    const isGarage = cRow?.company_type === 'garage';

    // Ventes (invoices) depuis la date de référence
    const [salesRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM invoices
      WHERE company_id = ${companyId} AND created_at >= ${refDate}
    `;

    // Ventes garage (grand_total des devis) depuis la date de référence
    let garageRevenue = 0;
    if (isGarage) {
      const [gr] = await sql\`
        SELECT COALESCE(SUM(grand_total), 0)::float AS total
        FROM garage_quotes
        WHERE company_id = \${companyId} AND created_at >= \${refDate}
      \`;
      garageRevenue = gr.total;
    }

    // Achats depuis la date de référence
    const [purchRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id  = ${companyId}
        AND purchase_date >= ${refDate}::date
    `;

    // Salaires payés depuis la date de référence
    const [salPaidRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM salary_payments
      WHERE company_id = ${companyId} AND paid_at >= ${refDate}
    `;

    const salesSince      = salesRow.total;
    const purchasesSince  = purchRow.total;
    const salariesPaid    = salPaidRow.total;
    const currentBalance  = refBalance + salesSince + garageRevenue - purchasesSince - salariesPaid;

    // ── Historique hebdomadaire (8 semaines glissantes) ──────────
    const weeklyHistory = await sql`
      WITH weeks AS (
        SELECT generate_series(
          DATE_TRUNC('week', NOW() - INTERVAL '7 weeks'),
          DATE_TRUNC('week', NOW()),
          '1 week'::interval
        )::date AS week_start
      ),
      ws AS (
        SELECT DATE_TRUNC('week', created_at)::date AS week,
               COALESCE(SUM(total_amount), 0)::float AS sales
        FROM invoices WHERE company_id = ${companyId} GROUP BY 1
      ),
      wp AS (
        SELECT DATE_TRUNC('week', purchase_date)::date AS week,
               COALESCE(SUM(total_amount), 0)::float AS purchases
        FROM purchases WHERE company_id = ${companyId} GROUP BY 1
      ),
      wsal AS (
        SELECT DATE_TRUNC('week', paid_at)::date AS week,
               COALESCE(SUM(total_amount), 0)::float AS salaries
        FROM salary_payments WHERE company_id = ${companyId} GROUP BY 1
      )
      SELECT w.week_start,
             COALESCE(ws.sales,     0) AS sales,
             COALESCE(wp.purchases, 0) AS purchases,
             COALESCE(wsal.salaries,0) AS salaries,
             COALESCE(ws.sales, 0) - COALESCE(wp.purchases, 0) - COALESCE(wsal.salaries, 0) AS delta
      FROM weeks w
      LEFT JOIN ws   ON ws.week   = w.week_start
      LEFT JOIN wp   ON wp.week   = w.week_start
      LEFT JOIN wsal ON wsal.week = w.week_start
      ORDER BY w.week_start
    `;

    return res.status(200).json({
      refBalance,
      garageRevenue,
      refDate,
      salesSince,
      purchasesSince,
      salariesPaid,
      currentBalance,
      weeklyHistory,
    });
  }

  // ── PUT : recalibrer le solde de référence ────────────────────
  if (req.method === 'PUT') {
    const { balance } = req.body;
    const val = parseFloat(balance);
    if (isNaN(val)) return res.status(400).json({ error: 'Solde invalide' });
    await sql`
      UPDATE companies
      SET account_balance = ${val}, balance_set_at = NOW()
      WHERE id = ${companyId}
    `;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
