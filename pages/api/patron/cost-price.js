import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companyId = token.companyId;

  // 1. Prix moyen pondéré d'achat par matière première (sur tout l'historique)
  const avgPrices = await sql`
    SELECT raw_material_id,
           (SUM(total_amount) / NULLIF(SUM(quantity), 0))::float AS avg_unit_price
    FROM purchases
    WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
    GROUP BY raw_material_id
  `;
  const purchaseMap = {};
  for (const row of avgPrices) {
    purchaseMap[row.raw_material_id] = row.avg_unit_price;
  }

  // 2. Prix unitaire saisi manuellement sur chaque matière première
  const rmPrices = await sql`
    SELECT id, COALESCE(unit_price, 0)::float AS unit_price
    FROM raw_materials
    WHERE company_id = ${companyId}
  `;
  const rmPriceMap = {};
  for (const row of rmPrices) {
    rmPriceMap[row.id] = row.unit_price;
  }

  // Priorité : prix moyen d'achat > prix unitaire manuel > null
  const getPriceForRM = (rmId) => {
    if (purchaseMap[rmId] != null && purchaseMap[rmId] > 0) return { price: purchaseMap[rmId], source: 'achat' };
    if (rmPriceMap[rmId] != null && rmPriceMap[rmId] > 0) return { price: rmPriceMap[rmId], source: 'manuel' };
    return { price: null, source: null };
  };

  // 3. Tous les produits
  const products = await sql`
    SELECT id, name, category, price::float, image_url
    FROM products
    WHERE company_id = ${companyId}
    ORDER BY name ASC
  `;

  // 4. Toutes les recettes de l'entreprise
  const recipes = await sql`
    SELECT pr.product_id, pr.raw_material_id, pr.quantity_per_unit::float,
           rm.name AS material_name, rm.unit
    FROM product_recipes pr
    JOIN raw_materials rm ON rm.id = pr.raw_material_id
    WHERE pr.company_id = ${companyId}
  `;

  // 5. Calculer le coût de revient de chaque produit
  const result = products.map(p => {
    const ingredients = recipes.filter(r => r.product_id === p.id);

    if (ingredients.length === 0) {
      return { ...p, cost_price: null, margin: null, margin_pct: null, ingredients: [], warning: null };
    }

    let costPrice = 0;
    let hasMissingPrice = false;

    const enrichedIngredients = ingredients.map(r => {
      const { price: unitPrice, source } = getPriceForRM(r.raw_material_id);
      if (unitPrice === null) {
        hasMissingPrice = true;
        return { ...r, unit_price: null, cost: null, price_source: null };
      }
      const cost = r.quantity_per_unit * unitPrice;
      costPrice += cost;
      return { ...r, unit_price: unitPrice, cost, price_source: source };
    });

    if (hasMissingPrice) {
      return {
        ...p,
        cost_price: null,
        margin: null,
        margin_pct: null,
        ingredients: enrichedIngredients,
        warning: 'Prix manquant pour un ou plusieurs ingrédients',
      };
    }

    const margin     = p.price - costPrice;
    const margin_pct = p.price > 0 ? (margin / p.price) * 100 : 0;

    return {
      ...p,
      cost_price: costPrice,
      margin,
      margin_pct,
      ingredients: enrichedIngredients,
      warning: null,
    };
  });

  return res.status(200).json(result);
}
