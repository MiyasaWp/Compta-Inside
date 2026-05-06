import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  if (req.method !== 'GET') return res.status(405).end();

  const employeeId = parseInt(token.sub);
  const companyId  = token.companyId;

  const [user] = await sql`SELECT salary_percent::float FROM users WHERE id = ${employeeId}`;
  const salaryPercent = user?.salary_percent ?? 0;

  // Type d'entreprise
  const [companyRow] = await sql`
    SELECT COALESCE(company_type, 'cafe') AS company_type FROM companies WHERE id = ${companyId}
  `;
  const isGarage = companyRow?.company_type === 'garage';

  // Date du dernier paiement
  const [lastPayRow] = await sql`
    SELECT COALESCE(MAX(paid_at), '1970-01-01T00:00:00Z'::timestamptz) AS last_paid,
           MAX(paid_at) IS NOT NULL AS ever_paid
    FROM salary_payments WHERE company_id = ${companyId}
  `;
  const lastPaid = lastPayRow.last_paid;
  const everPaid = lastPayRow.ever_paid;

  let currentPeriod;

  if (isGarage) {
    // Garage : base = grand_total des devis (pas de coût matières)
    const [gRow] = await sql`
      SELECT
        COALESCE(SUM(grand_total), 0)::float AS gross_sales,
        COALESCE(SUM(GREATEST(0, grand_total - COALESCE(parts_total,0))), 0)::float AS margin,
        COUNT(*)::int                        AS nb_sales
      FROM garage_quotes
      WHERE employee_id = ${employeeId}
        AND company_id  = ${companyId}
        AND created_at  > ${lastPaid}
    `;
    currentPeriod = {
      grossSales: gRow.gross_sales,
      margin:     gRow.margin,
      salary:     (gRow.margin * salaryPercent) / 100,
      nbSales:    gRow.nb_sales,
    };
  } else {
    // Café : base = marge (vente − coût matières)
    const [cRow] = await sql`
      WITH avg_prices AS (
        SELECT raw_material_id,
               SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
        FROM purchases WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
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
      SELECT
        COALESCE(SUM(s.total_amount), 0)::float                                                                   AS gross_sales,
        COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float     AS margin,
        COUNT(*)::int                                                                                              AS nb_sales
      FROM sales s
      LEFT JOIN product_costs pc ON pc.product_id = s.product_id
      WHERE s.employee_id = ${employeeId}
        AND s.company_id  = ${companyId}
        AND s.sale_date   > ${lastPaid}
    `;
    currentPeriod = {
      grossSales: cRow.gross_sales,
      margin:     cRow.margin,
      salary:     (cRow.margin * salaryPercent) / 100,
      nbSales:    cRow.nb_sales,
    };
  }

  // Historique des paiements
  const paymentHistory = await sql`
    SELECT sp.id, sp.paid_at, sp.week_start, sp.total_amount::float AS company_total
    FROM salary_payments sp
    WHERE sp.company_id = ${companyId}
    ORDER BY sp.paid_at DESC LIMIT 8
  `;

  return res.status(200).json({
    salaryPercent,
    lastPaid,
    everPaid,
    currentPeriod,
    paymentHistory,
  });
}
