import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  if (req.method === 'GET') {
    // Type d'entreprise
    const [companyRow] = await sql`
      SELECT COALESCE(company_type, 'cafe') AS company_type FROM companies WHERE id = ${companyId}
    `;
    const isGarage = companyRow?.company_type === 'garage';

    // Date du dernier paiement
    const [lastPayRow] = await sql`
      SELECT COALESCE(MAX(paid_at), '1970-01-01T00:00:00Z'::timestamptz) AS last_paid
      FROM salary_payments WHERE company_id = ${companyId}
    `;
    const lastPaid = lastPayRow.last_paid;

    let employees;

    if (isGarage) {
      // Garage : base = grand_total des devis (pas de coût matières)
      employees = await sql`
        WITH period_data AS (
          SELECT gq.employee_id,
                 COALESCE(SUM(gq.grand_total), 0)::float AS gross_sales,
                 COALESCE(SUM(gq.grand_total), 0)::float AS margin
          FROM garage_quotes gq
          WHERE gq.company_id = ${companyId}
            AND gq.created_at > ${lastPaid}
          GROUP BY gq.employee_id
        ),
        month_data AS (
          SELECT gq.employee_id,
                 COALESCE(SUM(gq.grand_total), 0)::float AS gross_sales,
                 COALESCE(SUM(gq.grand_total), 0)::float AS margin
          FROM garage_quotes gq
          WHERE gq.company_id = ${companyId}
            AND DATE_TRUNC('month', gq.created_at) = DATE_TRUNC('month', NOW())
          GROUP BY gq.employee_id
        )
        SELECT
          u.id, u.name, u.email, u.role,
          u.salary_percent::float,
          COALESCE(pd.gross_sales, 0)::float                               AS week_sales,
          COALESCE(pd.margin,      0)::float                               AS week_margin,
          (COALESCE(pd.margin, 0) * u.salary_percent / 100)::float         AS week_salary,
          COALESCE(md.gross_sales, 0)::float                               AS total_sales,
          COALESCE(md.margin,      0)::float                               AS total_margin,
          (COALESCE(md.margin, 0) * u.salary_percent / 100)::float         AS salary_due
        FROM users u
        LEFT JOIN period_data pd ON pd.employee_id = u.id
        LEFT JOIN month_data  md ON md.employee_id = u.id
        WHERE u.company_id = ${companyId} AND u.status = 'active'
        ORDER BY week_salary DESC, u.name ASC
      `;
    } else {
      // Café : base = marge (vente − coût matières)
      employees = await sql`
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
        ),
        period_data AS (
          SELECT s.employee_id,
                 COALESCE(SUM(s.total_amount), 0)::float                                                                 AS gross_sales,
                 COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float   AS margin
          FROM sales s
          LEFT JOIN product_costs pc ON pc.product_id = s.product_id
          WHERE s.company_id = ${companyId}
            AND s.sale_date  > ${lastPaid}
          GROUP BY s.employee_id
        ),
        month_data AS (
          SELECT s.employee_id,
                 COALESCE(SUM(s.total_amount), 0)::float                                                                 AS gross_sales,
                 COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float   AS margin
          FROM sales s
          LEFT JOIN product_costs pc ON pc.product_id = s.product_id
          WHERE s.company_id = ${companyId}
            AND DATE_TRUNC('month', s.sale_date) = DATE_TRUNC('month', NOW())
          GROUP BY s.employee_id
        )
        SELECT
          u.id, u.name, u.email, u.role,
          u.salary_percent::float,
          COALESCE(pd.gross_sales, 0)::float                               AS week_sales,
          COALESCE(pd.margin,      0)::float                               AS week_margin,
          (COALESCE(pd.margin, 0) * u.salary_percent / 100)::float         AS week_salary,
          COALESCE(md.gross_sales, 0)::float                               AS total_sales,
          COALESCE(md.margin,      0)::float                               AS total_margin,
          (COALESCE(md.margin, 0) * u.salary_percent / 100)::float         AS salary_due
        FROM users u
        LEFT JOIN period_data pd ON pd.employee_id = u.id
        LEFT JOIN month_data  md ON md.employee_id = u.id
        WHERE u.company_id = ${companyId} AND u.status = 'active'
        ORDER BY week_salary DESC, u.name ASC
      `;
    }

    return res.status(200).json({ employees, lastPaid });
  }

  if (req.method === 'PUT') {
    const { id, salary_percent } = req.body;
    if (salary_percent == null || salary_percent < 0 || salary_percent > 100)
      return res.status(400).json({ error: 'Pourcentage invalide (0-100).' });
    await sql`UPDATE users SET salary_percent = ${salary_percent} WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID manquant.' });
    const [target] = await sql`SELECT id, role FROM users WHERE id = ${id} AND company_id = ${companyId}`;
    if (!target) return res.status(404).json({ error: 'Employé introuvable.' });
    if (target.role === 'patron' && token.role !== 'admin')
      return res.status(403).json({ error: 'Impossible de virer un patron.' });
    await sql`UPDATE users SET status = 'inactive' WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
