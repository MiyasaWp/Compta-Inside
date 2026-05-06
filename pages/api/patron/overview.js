import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';
import { computeWeeklyTax } from '../../../lib/tax';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companyId = token.companyId;

  // Déterminer le type d'entreprise
  const [companyRow] = await sql`
    SELECT COALESCE(company_type, 'cafe') AS company_type FROM companies WHERE id = ${companyId}
  `;
  const isGarage = companyRow?.company_type === 'garage';

  // ── CA de la semaine (sales + garage_quotes si garage) ────────
  const [weekSalesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
      AND sale_date >= DATE_TRUNC('week', NOW())
  `;
  const weekSalesRegular = weekSalesRow.total;

  let weekSalesGarage = 0;
  if (isGarage) {
    const [gRow] = await sql`
      SELECT COALESCE(SUM(grand_total), 0)::float AS total
      FROM garage_quotes
      WHERE company_id = ${companyId}
        AND created_at >= DATE_TRUNC('week', NOW())
    `;
    weekSalesGarage = gRow.total;
  }
  const weekSales = weekSalesRegular + weekSalesGarage;

  // ── Achats de la semaine ──────────────────────────────────────
  const [weekPurchRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM purchases
    WHERE company_id  = ${companyId}
      AND purchase_date >= DATE_TRUNC('week', NOW())
  `;
  const weekPurchases = weekPurchRow.total;

  // ── Salaires semaine ─────────────────────────────────────────
  // Pour les garages : salaire = grand_total × salary_percent (pas de coût matières)
  // Pour les cafés : salaire = marge × salary_percent
  const [salRow] = isGarage
    ? await sql`
        WITH base AS (
          SELECT
            gq.created_at AS sale_date,
            gq.grand_total * u.salary_percent / 100 AS sal_contrib
          FROM garage_quotes gq
          JOIN users u ON u.id = gq.employee_id
          WHERE gq.company_id = ${companyId}
            AND gq.created_at >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
        )
        SELECT
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW())),                                                                              0)::float AS week_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())),                                                         0)::float AS month_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '1 week'  AND sale_date < DATE_TRUNC('week', NOW())),               0)::float AS prev1_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '1 week'),  0)::float AS prev2_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks'), 0)::float AS prev3_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks'), 0)::float AS prev4_sal
        FROM base
      `
    : await sql`
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
        base AS (
          SELECT
            s.sale_date,
            GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0)) * u.salary_percent / 100 AS sal_contrib
          FROM sales s
          JOIN  users u ON u.id = s.employee_id
          LEFT JOIN product_costs pc ON pc.product_id = s.product_id
          WHERE s.company_id = ${companyId}
            AND s.sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
        )
        SELECT
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW())),                                                                           0)::float AS week_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())),                                                      0)::float AS month_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '1 week'  AND sale_date < DATE_TRUNC('week', NOW())),             0)::float AS prev1_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '1 week'),  0)::float AS prev2_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '2 weeks'), 0)::float AS prev3_sal,
          COALESCE(SUM(sal_contrib) FILTER (WHERE sale_date >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks' AND sale_date < DATE_TRUNC('week', NOW()) - INTERVAL '3 weeks'), 0)::float AS prev4_sal
        FROM base
      `;

  const weekSalaries  = salRow[0]?.week_sal  ?? 0;
  const monthSalaries = salRow[0]?.month_sal ?? 0;

  // ── IRS semaine en cours ──────────────────────────────────────
  const weekNetRaw  = weekSales - weekPurchases - weekSalaries;
  const weekTaxBase = Math.max(0, weekNetRaw);
  const weekTax     = computeWeeklyTax(weekTaxBase);

  // ── Mois en cours ────────────────────────────────────────────
  const [monthSalesRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM sales
    WHERE company_id = ${companyId}
      AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW())
  `;
  let monthSales = monthSalesRow.total;

  if (isGarage) {
    const [mgRow] = await sql`
      SELECT COALESCE(SUM(grand_total), 0)::float AS total
      FROM garage_quotes
      WHERE company_id = ${companyId}
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
    `;
    monthSales += mgRow.total;
  }

  const [monthPurchRow] = await sql`
    SELECT COALESCE(SUM(total_amount), 0)::float AS total
    FROM purchases
    WHERE company_id  = ${companyId}
      AND DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', NOW())
  `;
  const monthPurchases = monthPurchRow.total;

  const monthTaxBase        = Math.max(0, monthSales - monthPurchases - monthSalaries);
  const monthTaxBaseNoPurch = Math.max(0, monthSales - monthSalaries);
  const monthTaxObj         = computeWeeklyTax(monthTaxBase);
  const monthTaxNoPurchObj  = computeWeeklyTax(monthTaxBaseNoPurch);
  const taxSaving           = Math.max(0, monthTaxNoPurchObj.tax - monthTaxObj.tax);

  // ── 4 semaines précédentes ────────────────────────────────────
  const prevWeeks = [];
  const salRowData = salRow[0] || {};
  const prevSals  = [salRowData.prev1_sal||0, salRowData.prev2_sal||0, salRowData.prev3_sal||0, salRowData.prev4_sal||0];

  for (let i = 1; i <= 4; i++) {
    const [s] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM sales
      WHERE company_id = ${companyId}
        AND sale_date >= DATE_TRUNC('week', NOW()) - (${i}  * INTERVAL '1 week')
        AND sale_date <  DATE_TRUNC('week', NOW()) - (${i - 1} * INTERVAL '1 week')
    `;
    let prevSalesTotal = s.total;

    if (isGarage) {
      const [sg] = await sql`
        SELECT COALESCE(SUM(grand_total), 0)::float AS total
        FROM garage_quotes
        WHERE company_id = ${companyId}
          AND created_at >= DATE_TRUNC('week', NOW()) - (${i}  * INTERVAL '1 week')
          AND created_at <  DATE_TRUNC('week', NOW()) - (${i - 1} * INTERVAL '1 week')
      `;
      prevSalesTotal += sg.total;
    }

    const [p] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id  = ${companyId}
        AND purchase_date >= DATE_TRUNC('week', NOW()) - (${i}  * INTERVAL '1 week')
        AND purchase_date <  DATE_TRUNC('week', NOW()) - (${i - 1} * INTERVAL '1 week')
    `;
    const sal     = prevSals[i - 1];
    const netRaw  = prevSalesTotal - p.total - sal;
    const taxBase = Math.max(0, netRaw);
    const tax     = computeWeeklyTax(taxBase);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - i * 7);
    prevWeeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      sales:     prevSalesTotal,
      purchases: p.total,
      salaries:  sal,
      net:       netRaw,
      taxBase,
      tax:       tax.tax,
      rate:      tax.rate,
      bracket:   tax.bracket,
    });
  }

  // ── Alertes stock bas ─────────────────────────────────────────
  const [alertRow] = await sql`
    SELECT COUNT(*)::int AS count FROM raw_materials
    WHERE company_id = ${companyId} AND quantity <= min_alert
  `;

  // ── 10 dernières ventes / devis ───────────────────────────────
  let recentSales = [];
  if (isGarage) {
    recentSales = await sql`
      SELECT gq.id, u.name AS employee_name,
             CONCAT(gq.client_first_name, ' ', gq.client_last_name) AS product_name,
             1 AS quantity, gq.grand_total::float AS total_amount, gq.created_at AS sale_date
      FROM garage_quotes gq
      JOIN users u ON u.id = gq.employee_id
      WHERE gq.company_id = ${companyId}
      ORDER BY gq.created_at DESC
      LIMIT 10
    `;
  } else {
    recentSales = await sql`
      SELECT s.id, u.name AS employee_name, p.name AS product_name,
             s.quantity, s.total_amount::float, s.sale_date
      FROM sales s
      JOIN users    u ON u.id = s.employee_id
      JOIN products p ON p.id = s.product_id
      WHERE s.company_id = ${companyId}
      ORDER BY s.sale_date DESC
      LIMIT 10
    `;
  }

  return res.status(200).json({
    weekSales,
    weekPurchases,
    weekSalaries,
    weekNet:              weekNetRaw,
    weekTaxBase,
    weekTaxAmount:        weekTax.tax,
    weekTaxRate:          weekTax.rate,
    weekTaxEffectiveRate: weekTax.effectiveRate,
    weekBracket:          weekTax.bracket,
    totalSales:     monthSales,
    totalPurchases: monthPurchases,
    totalSalaries:  monthSalaries,
    taxableBase:    monthTaxBase,
    taxSaving,
    taxes:          monthTaxObj.tax,
    taxRate:        monthTaxObj.rate,
    prevWeeks,
    alertsCount:  alertRow.count,
    recentSales,
  });
}
