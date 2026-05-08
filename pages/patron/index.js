import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';


// ─── Grille tarifaire Garage (Piers 76) ─────────────────────────────────────
const GARAGE_CATEGORIES = ['Compacts','Sedans','Coupés','Motos','Muscle','SUV','Sport','Sports classic','Super'];
const GARAGE_PERF_PRICES = {
  'Moteur 1':[2000,2500,6000,9500,12500,20000,50000,60000,110000],
  'Moteur 2':[3000,5000,8000,13000,15000,30000,60000,75000,120000],
  'Moteur 3':[5000,8000,20000,20000,25000,50000,80000,85000,130000],
  'Moteur 4':[10000,15000,35000,45000,40000,65000,95000,98000,140000],
  'Moteur 5':[20000,35000,60000,75000,80000,90000,125000,110000,150000],
  'Turbo':[50000,60000,75000,95000,120000,140000,160000,160000,200000],
  'Transmission 1':[8000,10000,10000,25000,25000,35000,40000,40000,50000],
  'Transmission 2':[12000,15000,15000,35000,35000,45000,55000,55000,60000],
  'Transmission 3':[15000,25000,25000,42500,42500,56000,62500,62500,75000],
  'Transmission 4':[20000,40000,40000,55000,55000,70000,75000,75000,90000],
  'Freins 1':[6500,8000,8000,11000,11000,15000,20000,20000,30000],
  'Freins 2':[9000,11000,11000,16500,16500,20000,30000,30000,40000],
  'Freins 3':[11500,16500,16500,20000,20000,25000,40000,40000,60000],
  'Freins 4':[18000,20000,20000,30000,30000,40000,60000,60000,85000],
  'Suspensions 1':[5000,6000,8000,6000,20000,20000,25000,25000,30000],
  'Suspensions 2':[7500,8000,11000,8000,25000,30000,40000,40000,50000],
  'Suspensions 3':[10000,10000,13500,10000,30000,40000,60000,60000,70000],
};
const GARAGE_PERF_GROUPS = {
  '🔧 Moteur':['Moteur 1','Moteur 2','Moteur 3','Moteur 4','Moteur 5','Turbo'],
  '⚙️ Transmission':['Transmission 1','Transmission 2','Transmission 3','Transmission 4'],
  '🛑 Freins':['Freins 1','Freins 2','Freins 3','Freins 4'],
  '🔩 Suspensions':['Suspensions 1','Suspensions 2','Suspensions 3'],
};
const GARAGE_CUSTOM_GROUPS = {
  '🚗 Carrosserie': {
    'Aileron':1500,'Bas de caisse':1200,'Pare-choc AV':1500,'Pare-choc AR':1500,
    'Capot':1000,'Aile gauche':700,'Aile droite':700,'Toit':850,'Ailes':750,
    'Contour de plaque':400,'Calandre':400,'Coffre':400,'Rétroviseur':400,
    'Light bar':400,'Phares':650,'Roues':900,'Vitres':900,'Fenêtre':400,
    'Arceaux de sécurité':800,
  },
  '⚙️ Mécanique': {
    'Échappement':800,'Grille':800,'Bloc moteur':400,'Filtre à air':400,
    'Hydraulique':400,'Klaxon':150,
  },
  '🎭 Intérieur & Options': {
    'Néon intérieur':400,'Intérieur':450,'Plaques':450,'Caches-roues':400,
    'Antennes':400,'Accessoires':400,'Réservoir':400,'Extra':1000,
  },
  '🛠️ Services': {
    'Répa moteur':150,'Répa Carrosserie':100,'Nettoyage':50,
  },
};
// Prix plat dérivé des groupes (pour les calculs)
const GARAGE_CUSTOM_PRICES = Object.assign({}, ...Object.values(GARAGE_CUSTOM_GROUPS));
const GARAGE_PAINT_GROUPS = {
  '🎨 Peinture principale':{'Principale - Normale':500,'Principale - Métallique':750,'Principale - Pearl':750,'Principale - Matte':850,'Principale - Metal':850,'Principale - Chrome':1200},
  '🖌️ Peinture secondaire':{'Secondaire - Normale':500,'Secondaire - Métallique':750,'Secondaire - Pearl':750,'Secondaire - Matte':850,'Secondaire - Metal':850,'Secondaire - Chrome':1200},
  '✨ Finitions':{'Nacrage':700,'Motifs':1000,'Stickers':1000,'Couleurs intérieur':500,'Couleurs tableau de bord':500},
};
// ─── Coûts d'usine (prix d'achat pièces) ────────────────────────────────────
const GARAGE_PERF_COSTS = {
  'Moteur 1':[1600,2000,4800,7600,10000,16000,40000,48000,88000],
  'Moteur 2':[2400,4000,6400,10400,12000,24000,48000,60000,96000],
  'Moteur 3':[4000,6400,16000,16000,20000,40000,64000,68000,104000],
  'Moteur 4':[8000,12000,28000,36000,32000,52000,76000,78400,112000],
  'Moteur 5':[16000,28000,48000,60000,64000,72000,100000,88000,120000],
  'Turbo':[40000,48000,60000,76000,96000,112000,128000,128000,160000],
  'Transmission 1':[6400,8000,8000,20000,20000,28000,32000,32000,40000],
  'Transmission 2':[9600,12000,12000,28000,28000,36000,44000,44000,48000],
  'Transmission 3':[12000,20000,20000,34000,34000,44800,50000,50000,60000],
  'Transmission 4':[16000,32000,32000,44000,44000,56000,60000,60000,72000],
  'Freins 1':[5200,6400,6400,8800,8800,12000,16000,16000,24000],
  'Freins 2':[7200,8800,8800,13200,13200,16000,24000,24000,32000],
  'Freins 3':[9200,13200,13200,16000,16000,20000,32000,32000,48000],
  'Freins 4':[14400,16000,16000,24000,24000,32000,48000,48000,68000],
  'Suspensions 1':[4000,4800,6400,4800,16000,16000,20000,20000,24000],
  'Suspensions 2':[6000,6400,8800,6400,20000,24000,32000,32000,40000],
  'Suspensions 3':[8000,8000,10800,8000,24000,32000,48000,48000,56000],
};
const GARAGE_CUSTOM_COSTS = {
  'Aileron':1200,'Bas de caisse':960,'Pare-choc AV':1200,'Pare-choc AR':1200,
  'Échappement':640,'Arceaux de sécurité':640,'Grille':640,'Capot':800,
  'Aile gauche':560,'Aile droite':560,'Toit':680,'Contour de plaque':320,
  'Calandre':320,'Néon intérieur':320,'Coffre':320,'Hydraulique':320,
  'Bloc moteur':320,'Filtre à air':320,'Accessoires':320,'Caches-roues':320,
  'Antennes':320,'Ailes':600,'Réservoir':320,'Fenêtre':320,'Rétroviseur':320,
  'Light bar':320,'Klaxon':120,'Phares':520,'Roues':720,'Vitres':720,
  'Intérieur':360,'Plaques':360,'Extra':800,
  // Services (coût = prix achat Tarification)
  'Répa moteur':100,'Répa Carrosserie':50,'Nettoyage':25,
};
const GARAGE_PAINT_COSTS = {
  'Principale - Normale':400,'Principale - Métallique':600,'Principale - Pearl':600,
  'Principale - Matte':680,'Principale - Metal':680,'Principale - Chrome':960,
  'Secondaire - Normale':400,'Secondaire - Métallique':600,'Secondaire - Pearl':600,
  'Secondaire - Matte':680,'Secondaire - Metal':680,'Secondaire - Chrome':960,
  'Nacrage':560,'Motifs':800,'Stickers':800,
  'Couleurs intérieur':400,'Couleurs tableau de bord':400,
};

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ─── Composant principal ─────────────────────────────────────
export default function PatronDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  // Données
  const [overview, setOverview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchasesData, setPurchasesData] = useState({ purchases: [], totalPurchases: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  // Formulaire achat
  const [acName, setAcName]         = useState('');
  const [acMaterial, setAcMaterial] = useState('');
  const [acLots, setAcLots]         = useState('1'); // nombre de lots achetés
  const [acQty, setAcQty]           = useState('');  // quantité par lot
  const [acPrice, setAcPrice]       = useState('');  // prix d'un lot
  const [acNotes, setAcNotes]       = useState('');

  // Recettes produits
  const [recipeProduct, setRecipeProduct] = useState(null); // produit en cours d'édition
  const [recipe, setRecipe]               = useState([]);
  const [recipeRm, setRecipeRm]           = useState('');
  const [recipeQty, setRecipeQty]         = useState('1');

  // Formulaire matière première
  const [rmName, setRmName]       = useState('');
  const [rmUnit, setRmUnit]       = useState('unité');
  const [rmQty, setRmQty]         = useState('0');
  const [rmAlert, setRmAlert]     = useState('5');
  const [rmPrice, setRmPrice]     = useState('0');
  const [editingRm, setEditingRm] = useState(null);
  const [editingRmStock, setEditingRmStock] = useState(null);
  // Stock donné / initial (sans achat)
  const [giftRmId, setGiftRmId]   = useState(null); // id matière en cours de "stock donné"
  const [giftQty, setGiftQty]     = useState('');
  const [giftLabel, setGiftLabel] = useState('');

  // États UI
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Changement de mot de passe
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew,     setCpNew]     = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  // Modales / formulaires
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Formulaire produit
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [pAlert, setPAlert] = useState('5');
  const [pImageUrl, setPImageUrl] = useState('');

  // Formulaire vente (ancien, gardé pour compat)
  const [sEmployee, setSEmployee] = useState('');
  const [sProduct, setSProduct] = useState('');
  const [sQty, setSQty] = useState('1');

  // Panier (onglet Ventes)
  const [cart, setCart] = useState([]);
  const [cartEmployee, setCartEmployee] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [expandedInv, setExpandedInv] = useState(null);
  const [costPrices, setCostPrices] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [showMovements, setShowMovements] = useState(false);

  // Solde bancaire
  const [balance, setBalance]               = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalanceVal, setNewBalanceVal]   = useState('');

  // Paiement salaires
  const [salaryPayment, setSalaryPayment]   = useState(null);
  const [payingNow, setPayingNow]           = useState(false);
  const [lastPaidDate, setLastPaidDate]     = useState(null);

  // Garage / Devis
  const [devisClient,    setDevisClient]    = useState({firstName:'',lastName:'',model:'',category:'Sport'});
  const [devisSelPerfs,  setDevisSelPerfs]  = useState(new Set());
  const [devisSelCustoms,setDevisSelCustoms]= useState(new Set());
  const [devisSelPaints, setDevisSelPaints] = useState(new Set());
  const [devisNotes,     setDevisNotes]     = useState('');
  const [devisSection,   setDevisSection]   = useState('perfs');
  const [garageQuotes,   setGarageQuotes]   = useState([]);
  const [expandedQuote,  setExpandedQuote]  = useState(null);
  const [devisLoading,   setDevisLoading]   = useState(false);
  const [registreFilter, setRegistreFilter] = useState('all'); // 'all' | 'week' | 'month'

  // Multi-entreprises
  const [myCompanies,    setMyCompanies]    = useState([]);
  const [showCompSwitch, setShowCompSwitch] = useState(false);
  const [activeCompId,   setActiveCompId]   = useState(null); // null = use JWT default

  // ── Recherche / filtres ────────────────────────────────────
  const [invoiceSearch,  setInvoiceSearch]  = useState('');
  const [productSearch,  setProductSearch]  = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [stockSearch,    setStockSearch]    = useState('');

  // Redirection si pas patron
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && !['patron', 'admin'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Multi-entreprises : récupérer la liste + restaurer le choix sauvegardé
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/patron/my-companies').then(r => r.json()).then(d => {
      if (d.companies && d.companies.length > 1) {
        setMyCompanies(d.companies);
        const saved = typeof window !== 'undefined' ? localStorage.getItem('activeCompId') : null;
        if (saved && d.companies.find(co => String(co.id) === saved)) {
          setActiveCompId(parseInt(saved));
        }
      }
    }).catch(() => {});
  }, [status]);

  // companyParam : ajoute ?cid=X aux appels API si une autre entreprise est sélectionnée
  const getCP = useCallback(() =>
    (activeCompId && activeCompId !== session?.user?.companyId) ? `?cid=${activeCompId}` : ''
  , [activeCompId, session?.user?.companyId]);

  // Chargements des données selon l'onglet
  const loadOverview = useCallback(async () => {
    const r = await fetch(`/api/patron/overview${getCP()}`);
    const d = await r.json();
    setOverview(d);
  }, []);

  const loadEmployees = useCallback(async () => {
    const r = await fetch(`/api/patron/employees${getCP()}`);
    const d = await r.json();
    setEmployees(d.employees ?? d);  // { employees, lastPaid } or plain array
    if (d.lastPaid) setLastPaidDate(d.lastPaid);
  }, []);

  const loadProducts = useCallback(async () => {
    const r = await fetch(`/api/patron/products${getCP()}`);
    setProducts(await r.json());
  }, []);

  const loadSales = useCallback(async () => {
    const r = await fetch(`/api/patron/sales${getCP()}`);
    setSales(await r.json());
  }, []);

  const loadInvoices = useCallback(async () => {
    const r = await fetch('/api/invoices');
    setInvoices(await r.json());
  }, []);

  const loadPurchases = useCallback(async () => {
    const r = await fetch(`/api/patron/purchases${getCP()}`);
    setPurchasesData(await r.json());
  }, []);

  const loadPending = useCallback(async () => {
    const r = await fetch(`/api/patron/pending${getCP()}`);
    setPendingUsers(await r.json());
  }, []);

  const loadRawMaterials = useCallback(async () => {
    const r = await fetch('/api/patron/raw-materials');
    setRawMaterials(await r.json());
  }, []);

  const loadCostPrices = useCallback(async () => {
    const r = await fetch('/api/patron/cost-price');
    setCostPrices(await r.json());
  }, []);

  const loadStockMovements = useCallback(async () => {
    const r = await fetch('/api/patron/stock-movements');
    setStockMovements(await r.json());
  }, []);

  const loadBalance = useCallback(async () => {
    const r = await fetch(`/api/patron/balance${getCP()}`);
    setBalance(await r.json());
  }, []);

  const loadGarageQuotes = useCallback(async () => {
    const r = await fetch('/api/garage/devis');
    if (r.ok) { const d = await r.json(); setGarageQuotes(d.quotes || []); }
  }, []);


  const loadSalaryPayment = useCallback(async () => {
    const r = await fetch(`/api/patron/salary-payment${getCP()}`);
    setSalaryPayment(await r.json());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadOverview();
    loadBalance();
    loadPending(); // toujours chargé pour le badge
    if (tab === 'salaires') { loadEmployees(); loadProducts(); loadSales(); loadSalaryPayment(); }
    if (tab === 'devis')    { /* nothing to preload */ }
    if (tab === 'registre') { loadGarageQuotes(); }
    if (tab === 'ventes')   { loadProducts(); loadEmployees(); loadInvoices(); }
    if (tab === 'produits') { loadProducts(); loadRawMaterials(); loadCostPrices(); }
    if (tab === 'stocks')   { loadRawMaterials(); loadStockMovements(); }
    if (tab === 'achats')   { loadPurchases(); loadRawMaterials(); }
  }, [tab, status, loadOverview, loadBalance, loadSalaryPayment, loadEmployees, loadProducts, loadSales, loadInvoices, loadPurchases, loadPending, loadRawMaterials, loadCostPrices, loadStockMovements]);

  // ── Changement de mot de passe ────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    if (cpNew !== cpConfirm) return showToast('Les deux nouveaux mots de passe ne correspondent pas.', 'error');
    setCpLoading(true);
    const r = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
    });
    const d = await r.json();
    setCpLoading(false);
    if (r.ok) { showToast('✅ Mot de passe modifié !'); setCpCurrent(''); setCpNew(''); setCpConfirm(''); }
    else showToast(d.error, 'error');
  }

  // ── Recalibrage solde bancaire ─────────────────────────────
  async function handleUpdateBalance(e) {
    e.preventDefault();
    const val = parseFloat(newBalanceVal);
    if (isNaN(val)) return showToast('Solde invalide', 'error');
    const r = await fetch('/api/patron/balance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: val }),
    });
    if (r.ok) {
      showToast('\u2705 Solde de référence mis à jour !');
      setEditingBalance(false);
      setNewBalanceVal('');
      loadBalance();
    } else showToast('Erreur lors de la mise à jour', 'error');
  }

  // ── Paiement des salaires de la semaine ──────────────────────
  async function handlePaySalaries() {
    if (!confirm('Confirmer le paiement des salaires de la semaine ? Cette action est irréversible.')) return;
    setPayingNow(true);
    const r = await fetch('/api/patron/salary-payment', { method: 'POST' });
    const d = await r.json();
    setPayingNow(false);
    if (r.ok) {
      showToast(`✅ Salaires payés — ${fmt(d.total)} déduits du solde`);
      loadSalaryPayment();
      loadBalance();
    } else {
      showToast(d.error, 'error');
    }
  }

  // ── Actions matières premières ─────────────────────────────
  async function handleAddRm(e) {
    e.preventDefault();
    setLoading(true);
    const body = editingRm
      ? { id: editingRm.id, name: rmName, unit: rmUnit, min_alert: parseFloat(rmAlert), unit_price: parseFloat(rmPrice) || 0 }
      : { name: rmName, unit: rmUnit, quantity: parseFloat(rmQty) || 0, min_alert: parseFloat(rmAlert) || 5, unit_price: parseFloat(rmPrice) || 0 };
    const r = await fetch('/api/patron/raw-materials', {
      method: editingRm ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (r.ok) { showToast(editingRm ? 'Matière première modifiée !' : 'Matière première ajoutée !'); setEditingRm(null); setRmName(''); setRmUnit('unité'); setRmQty('0'); setRmAlert('5'); setRmPrice('0'); loadRawMaterials(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleDeleteRm(id) {
    if (!confirm('Supprimer cette matière première ?')) return;
    await fetch('/api/patron/raw-materials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Supprimée.'); loadRawMaterials();
  }

  async function handleUpdateRmStock(id, qty) {
    await fetch('/api/patron/raw-materials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity: parseFloat(qty) }) });
    showToast('Stock mis à jour !'); setEditingRmStock(null); loadRawMaterials(); loadOverview();
  }

  // Ajout de stock sans achat (stock initial / donné) — pas de débit du solde
  async function handleGiftStock(e) {
    e.preventDefault();
    if (!giftRmId || !giftQty || parseFloat(giftQty) <= 0) return;
    const r = await fetch('/api/patron/stock-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_material_id: giftRmId,
        quantity: parseFloat(giftQty),
        label: giftLabel || 'Stock initial / donné',
      }),
    });
    const d = await r.json();
    if (r.ok) {
      showToast(`✅ Stock ajouté — nouveau total : ${d.new_qty}`);
      setGiftRmId(null); setGiftQty(''); setGiftLabel('');
      loadRawMaterials(); loadStockMovements();
    } else {
      showToast(d.error, 'error');
    }
  }

  // ── Actions recettes produits ──────────────────────────────
  async function loadRecipe(productId) {
    const r = await fetch(`/api/patron/recipes?product_id=${productId}`);
    setRecipe(await r.json());
  }

  async function handleAddIngredient(e) {
    e.preventDefault();
    if (!recipeRm) return showToast('Sélectionne une matière première.', 'error');
    const r = await fetch('/api/patron/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: recipeProduct.id, raw_material_id: parseInt(recipeRm), quantity_per_unit: parseFloat(recipeQty) || 1 }),
    });
    if (r.ok) { showToast('Ingrédient ajouté !'); setRecipeRm(''); setRecipeQty('1'); loadRecipe(recipeProduct.id); loadProducts(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleDeleteIngredient(id) {
    await fetch('/api/patron/recipes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Ingrédient retiré.'); loadRecipe(recipeProduct.id); loadProducts();
  }

  // ── Actions validation comptes ─────────────────────────────
  async function handleAccountAction(id, action) {
    const label = action === 'approve' ? 'approuver' : 'refuser';
    if (!confirm(`Veux-tu ${label} ce compte ?`)) return;
    const r = await fetch('/api/patron/pending', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (r.ok) {
      showToast(action === 'approve' ? '✅ Compte approuvé !' : '❌ Compte refusé.');
      loadPending();
      loadEmployees();
    }
  }

  // ── Actions achats ─────────────────────────────────────────
  async function handleAddPurchase(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: acName,
        raw_material_id: acMaterial || null,
        quantity: (parseFloat(acLots) || 1) * (parseFloat(acQty) || 1), // lots × qté/lot
        unit_price: parseFloat(acPrice) / (parseFloat(acQty) || 1),     // prix par unité = lot / qté
        notes: acNotes || null,
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) {
      showToast(`✅ Achat enregistré — ${fmt(d.total_amount)}${acMaterial ? ' · Stock matière réapprovisionné' : ''}`);
      setAcName(''); setAcMaterial(''); setAcLots('1'); setAcQty(''); setAcPrice(''); setAcNotes('');
      loadPurchases(); loadOverview(); if (acMaterial) loadRawMaterials();
    } else {
      showToast(d.error, 'error');
    }
  }

  async function handleDeletePurchase(id) {
    if (!confirm('Supprimer cet achat ? Le stock sera ajusté si applicable.')) return;
    await fetch('/api/patron/purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Achat supprimé.'); loadPurchases(); loadOverview(); loadRawMaterials();
  }

  // ── Gestion du panier (onglet Ventes) ────────────────────
  function addToCart(product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }
  function removeFromCart(product_id) { setCart((prev) => prev.filter((i) => i.product_id !== product_id)); }
  function setCartQty(product_id, qty) {
    const n = parseInt(qty); if (isNaN(n) || n < 1) return;
    setCart((prev) => prev.map((i) => i.product_id === product_id ? { ...i, quantity: n } : i));
  }
  const cartTotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);

  async function submitCart() {
    if (cart.length === 0) return showToast('Le panier est vide.', 'error');
    if (!cartEmployee) return showToast('Sélectionne un employé.', 'error');
    setLoading(true);
    const r = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: parseInt(cartEmployee), items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) { showToast(`✅ Facture #${d.invoice_id} créée — ${fmt(d.total_amount)}`); setCart([]); loadInvoices(); loadOverview(); }
    else showToast(d.error, 'error');
  }

  async function handleDeleteInvoice(id) {
    if (!confirm('Annuler cette facture et remettre le stock ?')) return;
    await fetch('/api/invoices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Facture annulée.'); loadInvoices(); loadOverview();
  }

  // ── Actions produits ──
  async function handleAddProduct(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName, category: pCategory, price: parseFloat(pPrice), image_url: pImageUrl || null }),
    });
    setLoading(false);
    if (r.ok) { showToast('Produit ajouté !'); setShowAddProduct(false); resetProductForm(); loadProducts(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleEditProduct(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingProduct.id, name: pName, category: pCategory, price: parseFloat(pPrice), image_url: pImageUrl || null }),
    });
    setLoading(false);
    if (r.ok) { showToast('Produit modifié !'); setEditingProduct(null); resetProductForm(); loadProducts(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleDeleteProduct(id) {
    if (!confirm('Supprimer ce produit ? Cette action est irréversible.')) return;
    const r = await fetch('/api/patron/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (r.ok) {
      showToast('Produit supprimé.');
      if (recipeProduct?.id === id) { setRecipeProduct(null); setRecipe([]); }
      loadProducts();
    } else {
      let msg = 'Impossible de supprimer ce produit.';
      try { const d = await r.json(); if (d.error) msg = d.error; } catch {}
      showToast(msg, 'error');
    }
  }

  function openEditProduct(p) {
    setEditingProduct(p);
    setPName(p.name); setPCategory(p.category); setPPrice(String(p.price)); setPImageUrl(p.image_url || '');
    setShowAddProduct(false);
  }

  function resetProductForm() { setPName(''); setPCategory(''); setPPrice(''); setPImageUrl(''); }

  // ── Actions stock ──
  async function handleUpdateStock(id, qty) {
    const r = await fetch('/api/patron/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stock_quantity: parseInt(qty) }),
    });
    if (r.ok) { showToast('Stock mis à jour !'); setEditingStock(null); loadProducts(); loadOverview(); }
    else { showToast('Erreur lors de la mise à jour.', 'error'); }
  }

  // ── Actions ventes ──
  async function handleAddSale(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: parseInt(sEmployee), product_id: parseInt(sProduct), quantity: parseInt(sQty) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) { showToast(`Vente enregistrée : ${fmt(d.total_amount)}`); setShowAddSale(false); setSEmployee(''); setSProduct(''); setSQty('1'); loadEmployees(); loadSales(); loadOverview(); }
    else showToast(d.error, 'error');
  }

  async function handleDeleteSale(id) {
    if (!confirm('Annuler cette vente ?')) return;
    await fetch('/api/patron/sales', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Vente annulée.'); loadSales(); loadEmployees(); loadOverview();
  }

  // ── Actions employés ──
  async function handleFireEmployee(id, name) {
    if (!confirm(`Virer ${name} ? Il/elle ne pourra plus accéder à l'application. L'historique des ventes est conservé.`)) return;
    const r = await fetch('/api/patron/employees', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (r.ok) { showToast(`${name} a été retiré(e) de l'entreprise.`); loadEmployees(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleUpdateSalaryPercent(id, pct) {
    const r = await fetch('/api/patron/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, salary_percent: parseFloat(pct) }),
    });
    if (r.ok) { showToast('Pourcentage mis à jour !'); setEditingEmployee(null); loadEmployees(); }
    else showToast('Erreur.', 'error');
  }

  if (status === 'loading' || !session) {
    return <div style={S.loadingPage}><div style={S.spinner} /></div>;
  }

  const pendingCount = pendingUsers.filter(u => u.status === 'pending').length;
  const isGarage = session.user.companyType === 'garage';
  const tabs = [
    { key: 'overview', label: '🏠 Vue d\'ensemble', badge: pendingCount },
    { key: 'ventes',   label: '🧾 Ventes' },
    { key: 'achats',   label: '🛍️ Achats' },
    { key: 'salaires', label: '💰 Salaires & Impôts' },
    { key: 'produits', label: '📦 Produits' },
    { key: 'stocks',   label: '📊 Stocks' },
    ...(isGarage ? [
      { key: 'devis',    label: '🔧 Devis Custom' },
      { key: 'registre', label: '📋 Registre' },
    ] : []),
    { key: 'compte',   label: '⚙️ Mon compte' },
  ];

  // ── Devis helpers ────────────────────────────────────────────────────────
  const garageCatIdx = GARAGE_CATEGORIES.indexOf(devisClient.category);
  const devisPerfsTotal   = [...devisSelPerfs].reduce((t,p) => t + (GARAGE_PERF_PRICES[p]?.[garageCatIdx]||0), 0);
  const devisCustomsTotal = [...devisSelCustoms].reduce((t,c) => t + (GARAGE_CUSTOM_PRICES[c]||0), 0);
  const dvisPaintsTotal   = [...devisSelPaints].reduce((t,p) => { for(const g of Object.values(GARAGE_PAINT_GROUPS)){if(g[p]) return t+g[p];} return t; }, 0);
  const devisGrandTotal   = devisPerfsTotal + devisCustomsTotal + dvisPaintsTotal;
  // Coûts d'usine (pièces)
  const devisPerfsPartsCost   = [...devisSelPerfs].reduce((t,p) => t + (GARAGE_PERF_COSTS[p]?.[garageCatIdx]||0), 0);
  const devisCustomsPartsCost = [...devisSelCustoms].reduce((t,c) => t + (GARAGE_CUSTOM_COSTS[c]||0), 0);
  const dvisPaintsPartsCost   = [...devisSelPaints].reduce((t,p) => t + (GARAGE_PAINT_COSTS[p]||0), 0);
  const devisPartsTotal       = devisPerfsPartsCost + devisCustomsPartsCost + dvisPaintsPartsCost;
  const devisMargin           = devisGrandTotal - devisPartsTotal;

  const toggleDevisPerf   = (p) => setDevisSelPerfs(s => { const n=new Set(s); n.has(p)?n.delete(p):n.add(p); return n; });
  const toggleDevisCustom = (c) => setDevisSelCustoms(s => { const n=new Set(s); n.has(c)?n.delete(c):n.add(c); return n; });
  const toggleDvisPaint   = (p) => setDevisSelPaints(s => { const n=new Set(s); n.has(p)?n.delete(p):n.add(p); return n; });
  const deleteQuote = async (id) => {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return;
    const r = await fetch(`/api/garage/devis?id=${id}`, { method: 'DELETE' });
    if (r.ok) { showToast('Devis supprimé'); setGarageQuotes(q => q.filter(x => x.id !== id)); }
    else showToast('Erreur lors de la suppression', 'error');
  };

  const resetDevis = () => {
    setDevisClient({firstName:'',lastName:'',model:'',category:'Sport'});
    setDevisSelPerfs(new Set()); setDevisSelCustoms(new Set()); setDevisSelPaints(new Set());
    setDevisNotes(''); setDevisSection('perfs');
  };
  const submitDevis = async () => {
    if (!devisClient.firstName && !devisClient.lastName) return showToast('Indiquez un nom client', 'error');
    setDevisLoading(true);
    const r = await fetch('/api/garage/devis', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        clientFirstName: devisClient.firstName, clientLastName: devisClient.lastName,
        vehicleModel: devisClient.model, vehicleCategory: devisClient.category,
        selectedPerformances: [...devisSelPerfs].map(p=>({type:p,price:GARAGE_PERF_PRICES[p]?.[garageCatIdx]||0})),
        selectedCustoms: [...devisSelCustoms].map(c=>({type:c,price:GARAGE_CUSTOM_PRICES[c]||0})),
        selectedPaints: [...devisSelPaints].map(p=>{let pr=0;for(const g of Object.values(GARAGE_PAINT_GROUPS)){if(g[p]){pr=g[p];break;}}return{type:p,price:pr};}),
        perfsTotal:devisPerfsTotal, customsTotal:devisCustomsTotal, paintsTotal:dvisPaintsTotal, grandTotal:devisGrandTotal, partsTotal:devisPartsTotal, notes:devisNotes,
      }),
    });
    setDevisLoading(false);
    if (r.ok) { showToast('Devis enregistré !'); resetDevis(); }
    else showToast('Erreur enregistrement', 'error');
  };

  return (
    <>
      <Head>
        <title>Dashboard Patron — {session.user.companyName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={S.page}>

        {/* Toast notification */}
        {toast && (
          <div style={{ ...S.toast, background: toast.type === 'error' ? '#dc2626' : '#16a34a' }}>
            {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
          </div>
        )}

        {/* Barre de navigation */}
        <nav className="ci-nav">
          <div className="ci-nav-left">
            <span className="ci-nav-logo">
              {session.user.companyType === 'garage' ? '🔧' : session.user.companyType === 'bar' ? '🍺' : '☕'} Compta-Inside
            </span>
            <span className="ci-nav-company">{session.user.companyName}</span>
          </div>
          <div className="ci-nav-right">
            <span className="ci-nav-user">👤 {session.user.name}</span>
            {myCompanies.length > 1 && (
              <div style={{ position:'relative' }}>
                <button onClick={() => setShowCompSwitch(s=>!s)}
                  style={{ padding:'6px 14px', background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:8, color:'#60a5fa', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  🏢 {myCompanies.find(co=>co.id===(activeCompId||session.user.companyId))?.name || session.user.companyName} ▾
                </button>
                {showCompSwitch && (
                  <div style={{ position:'absolute', top:'110%', right:0, background:'#16102a', border:'1px solid rgba(96,165,250,0.25)', borderRadius:10, boxShadow:'0 8px 32px rgba(0,0,0,0.7)', zIndex:1000, minWidth:200, overflow:'hidden' }}>
                    {myCompanies.map(co => (
                      <button key={co.id}
                        onClick={() => {
                          setActiveCompId(co.id);
                          if (typeof window !== 'undefined') localStorage.setItem('activeCompId', String(co.id));
                          setShowCompSwitch(false);
                          setTab('overview');
                        }}
                        style={{ display:'block', width:'100%', padding:'11px 16px', background:(activeCompId||session.user.companyId)===co.id?'rgba(96,165,250,0.12)':'none', border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)', color:(activeCompId||session.user.companyId)===co.id?'#60a5fa':'#c0a0d8', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'left' }}>
                        {co.company_type==='garage'?'🔧':co.company_type==='bar'?'🍺':'☕'} {co.name}
                        {(activeCompId||session.user.companyId)===co.id && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {session.user.companyType === 'garage' && (
              <a href='/garage' className="ci-nav-link">🔧 Piers 76</a>
            )}
            <button onClick={() => signOut({ callbackUrl: '/' })} className="ci-nav-btn">Déconnexion</button>
          </div>
        </nav>

        {/* ── Tab bar horizontale ── */}
        <div className="ci-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`ci-tab-btn${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.badge > 0 && (
                <span style={{ marginLeft:6, background:'#dc2626', color:'#fff', borderRadius:20, fontSize:10, fontWeight:700, padding:'1px 6px', verticalAlign:'middle' }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Contenu principal ── */}
        <main className="ci-page">

          {/* ══════════════════════════════════════════
              ONGLET : VUE D'ENSEMBLE
          ══════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div>

              {/* ── Alertes prioritaires ───────────────────────── */}
              {overview && overview.alertsCount > 0 && (
                <div style={S.alertBanner}>
                  ⚠️ <strong>{overview.alertsCount} matière{overview.alertsCount > 1 ? 's' : ''} première{overview.alertsCount > 1 ? 's' : ''}</strong> en stock bas !{' '}
                  <button style={S.alertLink} onClick={() => setTab('stocks')}>Voir les stocks →</button>
                </div>
              )}

              {/* Comptes en attente */}
              {pendingUsers.filter(u => u.status === 'pending').length > 0 && (
                <div style={S.pendingBox}>
                  <div style={S.pendingTitle}>🔔 Comptes en attente ({pendingUsers.filter(u => u.status === 'pending').length})</div>
                  <div style={S.pendingList}>
                    {pendingUsers.filter(u => u.status === 'pending').map(u => (
                      <div key={u.id} style={S.pendingRow}>
                        <div style={S.pendingInfo}>
                          <strong>{u.name}</strong>
                          <span style={S.pendingEmail}>{u.email}</span>
                          <span style={S.pendingDate}>Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div style={S.pendingActions}>
                          <button style={S.btnApprove} onClick={() => handleAccountAction(u.id, 'approve')}>✅ Approuver</button>
                          <button style={S.btnReject}  onClick={() => handleAccountAction(u.id, 'reject')}>❌ Refuser</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!overview ? <p style={S.loading}>Chargement…</p> : (() => {
                const netAfterTax = Math.max(0, overview.weekNet) - overview.weekTaxAmount;
                const bal = balance?.currentBalance ?? null;
                const balPos = bal === null || bal >= 0;
                const weeks = balance?.weeklyHistory || [];
                const maxAbs = Math.max(1, ...weeks.map(w => Math.abs(w.delta)));
                const W = 300; const H = 50; const pad = 3;
                const bw = weeks.length ? Math.floor((W - pad * 2) / weeks.length) - 2 : 30;
                return (
                  <>
                    {/* ── 3 métriques hero ─────────────────────────────── */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:20 }}>

                      {/* Solde bancaire */}
                      {bal !== null && (
                        <div style={{ background:'linear-gradient(145deg,#0c0a1e,#13102a)', border:`2px solid ${balPos?'rgba(22,163,74,0.4)':'rgba(220,38,38,0.4)'}`, borderRadius:16, padding:'20px 22px' }}>
                          <div style={{ fontSize:11, fontWeight:700, color: balPos?'#16a34a':'#dc2626', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🏦 Solde bancaire</div>
                          <div style={{ fontSize:34, fontWeight:900, color: balPos?'#4ade80':'#f87171', lineHeight:1 }}>{fmt(bal)}</div>
                          <div style={{ marginTop:10 }}>
                            <svg viewBox={`0 0 ${W} ${H+14}`} style={{ width:'100%', maxWidth:W }}>
                              {weeks.map((w,i) => {
                                const bh = Math.max(2, Math.round((Math.abs(w.delta)/maxAbs)*(H-pad*2)));
                                const x = pad + i*(bw+2);
                                const col = w.delta>=0?'#16a34a':'#dc2626';
                                const by = w.delta>=0 ? H-pad-bh : H-pad;
                                const d = new Date(w.week_start);
                                return <g key={i}><rect x={x} y={by} width={bw} height={bh} rx={2} fill={col} opacity={0.75}/><text x={x+bw/2} y={H+12} textAnchor="middle" fontSize="7" fill="#5a4080">{d.getDate()}/{d.getMonth()+1}</text></g>;
                              })}
                              <line x1={pad} y1={H-pad} x2={W-pad} y2={H-pad} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
                            </svg>
                          </div>
                          {!editingBalance ? (
                            <button onClick={()=>{setEditingBalance(true);setNewBalanceVal(bal.toFixed(2));}}
                              style={{ marginTop:8, padding:'5px 12px', background:'rgba(224,64,251,0.1)', color:'#c084fc', border:'1px solid rgba(224,64,251,0.25)', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                              ✏️ Recalibrer
                            </button>
                          ) : (
                            <form onSubmit={handleUpdateBalance} style={{ marginTop:8, display:'flex', gap:6, alignItems:'center' }}>
                              <input type="number" step="0.01" value={newBalanceVal} onChange={e=>setNewBalanceVal(e.target.value)}
                                style={{ ...S.input, width:110, padding:'5px 8px', fontSize:12 }} autoFocus />
                              <button type="submit" style={{ padding:'5px 12px', background:'#16a34a', color:'#fff', border:'none', borderRadius:7, cursor:'pointer', fontWeight:700 }}>✓</button>
                              <button type="button" onClick={()=>setEditingBalance(false)} style={{ padding:'5px 8px', background:'rgba(255,255,255,0.06)', color:'#8060a0', border:'none', borderRadius:7, cursor:'pointer' }}>✕</button>
                            </form>
                          )}
                        </div>
                      )}

                      {/* Bénéfice net */}
                      <div style={{ background:'linear-gradient(145deg,#0c0a1e,#13102a)', border:`2px solid ${netAfterTax>=0?'rgba(34,197,94,0.35)':'rgba(220,38,38,0.35)'}`, borderRadius:16, padding:'20px 22px' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#22c55e', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>📈 Bénéfice net — semaine</div>
                        <div style={{ fontSize:34, fontWeight:900, color: netAfterTax>=0?'#4ade80':'#f87171', lineHeight:1 }}>{fmt(netAfterTax)}</div>
                        <div style={{ marginTop:10, fontSize:13, color:'#7060a0' }}>après impôts IRS</div>
                        <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:4 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>CA</span><span style={{ color:'#c0a0e8' }}>{fmt(overview.weekSales)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>Achats</span><span style={{ color:'#d97706' }}>− {fmt(overview.weekPurchases)}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>Salaires</span><span style={{ color:'#7c3aed' }}>− {fmt(overview.weekSalaries)}</span>
                          </div>
                        </div>
                      </div>

                      {/* IRS */}
                      <div style={{ background:'linear-gradient(145deg,#1a0505,#200a0a)', border:'2px solid rgba(220,38,38,0.4)', borderRadius:16, padding:'20px 22px' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#991b1b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🏛️ Taxe IRS — semaine</div>
                        {overview.weekTaxRate === 0 ? (
                          <>
                            <div style={{ fontSize:34, fontWeight:900, color:'#4ade80', lineHeight:1 }}>0 $US</div>
                            <div style={{ marginTop:10, background:'rgba(74,222,128,0.1)', color:'#4ade80', borderRadius:8, padding:'6px 12px', fontSize:13, fontWeight:600, display:'inline-block' }}>✅ Exonéré cette semaine</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize:34, fontWeight:900, color:'#dc2626', lineHeight:1 }}>{fmt(overview.weekTaxAmount)}</div>
                            <div style={{ marginTop:6, fontSize:13, color:'#b91c1c' }}>à verser sur le compte IRS</div>
                          </>
                        )}
                        <div style={{ marginTop:14 }}>
                          <TaxBracketBar net={Math.max(0,overview.weekNet)} rate={overview.weekTaxRate} bracket={overview.weekBracket} />
                        </div>
                        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:4 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>Base imposable</span>
                            <span style={{ color: overview.weekNet<0?'#fbbf24':'#f87171', fontWeight:700 }}>
                              {overview.weekNet<0?`Perte (${fmt(overview.weekNet)})`:fmt(overview.weekNet)}
                            </span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>Tranche</span><span style={{ color:'#c0a0e8' }}>{overview.weekBracket}</span>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#9080b0' }}>
                            <span>Taux effectif</span><span style={{ color:'#c0a0e8' }}>{(overview.weekTaxRate*100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Historique 4 semaines ─────────────────────────── */}
                    {overview.prevWeeks && overview.prevWeeks.some(w => w.sales > 0) && (
                      <div style={{ marginBottom:20 }}>
                        <h3 style={S.subTitle}>📅 Historique — 4 semaines précédentes</h3>
                        <div style={S.tableWrap}>
                          <table style={S.table}>
                            <thead>
                              <tr>
                                <th style={S.th}>Semaine</th>
                                <th style={S.th}>CA</th>
                                <th style={S.th}>− Achats</th>
                                <th style={S.th}>− Salaires</th>
                                <th style={S.th}>Base imposable</th>
                                <th style={S.th}>Tranche</th>
                                <th style={S.th}>IRS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {overview.prevWeeks.map((w,i) => (
                                <tr key={i} style={S.tr}>
                                  <td style={S.td}>Sem. du {new Date(w.weekStart).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</td>
                                  <td style={S.td}>{fmt(w.sales)}</td>
                                  <td style={{ ...S.td, color:'#d97706' }}>− {fmt(w.purchases)}</td>
                                  <td style={{ ...S.td, color:'#7c3aed' }}>− {fmt(w.salaries)}</td>
                                  <td style={{ ...S.td, fontWeight:600 }}>{fmt(w.net)}</td>
                                  <td style={{ ...S.td, fontSize:12, color:'#8060a0' }}>{w.bracket}</td>
                                  <td style={{ ...S.td, fontWeight:700, color: w.tax>0?'#dc2626':'#5a4080' }}>{fmt(w.tax)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Comptes refusés ───────────────────────────────── */}
                    {pendingUsers.filter(u => u.status === 'rejected').length > 0 && (
                      <div style={{ ...S.pendingBox, borderColor:'rgba(220,38,38,0.4)', background:'rgba(220,38,38,0.08)', marginBottom:16 }}>
                        <div style={{ ...S.pendingTitle, color:'#dc2626' }}>❌ Comptes refusés ({pendingUsers.filter(u=>u.status==='rejected').length})</div>
                        <div style={S.pendingList}>
                          {pendingUsers.filter(u=>u.status==='rejected').map(u=>(
                            <div key={u.id} style={S.pendingRow}>
                              <div style={S.pendingInfo}><strong>{u.name}</strong><span style={S.pendingEmail}>{u.email}</span></div>
                              <button style={S.btnApprove} onClick={()=>handleAccountAction(u.id,'approve')}>↩️ Réapprouver</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Dernières ventes / devis ──────────────────────── */}
                    <h3 style={S.subTitle}>🕐 Dernières transactions</h3>
                    {overview.recentSales.length === 0 ? (
                      <p style={S.empty}>Aucune transaction ce mois-ci.</p>
                    ) : (
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.th}>Employé</th>
                              <th style={S.th}>Produit / Client</th>
                              <th style={S.th}>Montant</th>
                              <th style={S.th}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overview.recentSales.map(s => (
                              <tr key={s.id} style={S.tr}>
                                <td style={S.td}>{s.employee_name}</td>
                                <td style={S.td}>
                                  {s.type === 'devis' && <span style={{ fontSize:11, background:'rgba(251,191,36,0.15)', color:'#fbbf24', borderRadius:4, padding:'1px 6px', marginRight:6, fontWeight:700 }}>🔧</span>}
                                  {s.product_name}
                                </td>
                                <td style={{ ...S.td, fontWeight:600, color:'#4ade80' }}>{fmt(s.total_amount)}</td>
                                <td style={{ ...S.td, color:'#5a4080', fontSize:13 }}>{fmtDate(s.sale_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

                    {/* ══════════════════════════════════════════
              ONGLET : VENTES (panier multi-produits)
          ══════════════════════════════════════════ */}
          {tab === 'ventes' && (
            <div>
              <h2 style={S.sectionTitle}>Créer une facture</h2>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Catalogue */}
                <div style={{ flex: 3, minWidth: 280 }}>
                  <label style={S.label}>Employé concerné</label>
                  <select value={cartEmployee} onChange={e => setCartEmployee(e.target.value)} style={{ ...S.select, marginBottom: 20, maxWidth: 300 }}>
                    <option value="">-- Sélectionner un employé --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role === 'patron' ? 'Patron' : 'Employé'})</option>)}
                  </select>

                  <label style={S.label}>Produits</label>
                  {(() => {
                    const cats = [...new Set(products.map(p => p.category || 'Autre'))];
                    return cats.map(cat => (
                      <div key={cat} style={{ marginBottom: 22 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, height: 1, background: 'rgba(192,132,252,0.2)', display: 'inline-block' }} />
                          {cat}
                          <span style={{ flex: 6, height: 1, background: 'rgba(192,132,252,0.2)', display: 'inline-block' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 16 }}>
                          {products.filter(p => (p.category || 'Autre') === cat).map((p) => {
                            const inCart = cart.find((i) => i.product_id === p.id);
                            return (
                              <button key={p.id} type="button" onClick={() => addToCart(p)}
                                style={{ position: 'relative', background: inCart ? 'linear-gradient(145deg,#1e0a30,#280d40)' : 'linear-gradient(145deg,#16102a,#1e1435)', border: `2px solid ${inCart ? '#e040fb' : 'rgba(224,64,251,0.15)'}`, borderRadius: 16, padding: '20px 14px', cursor: 'pointer', textAlign: 'center', boxShadow: inCart ? '0 4px 20px rgba(224,64,251,0.25)' : '0 4px 16px rgba(0,0,0,0.4)' }}>
                                {inCart && <div style={{ position: 'absolute', top: -8, right: -8, background: 'linear-gradient(135deg,#b020d0,#f060ff)', color: '#fff', borderRadius: '50%', width: 30, height: 30, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×{inCart.quantity}</div>}
                                {p.image_url
                                  ? <img src={p.image_url} alt={p.name} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, marginBottom: 10, display: 'block', margin: '0 auto 12px' }} onError={e => e.target.style.display='none'} />
                                  : <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                                }
                                <div style={{ fontWeight: 700, fontSize: 17, color: '#f0e8ff', marginBottom: 5 }}>{p.name}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#e040fb', marginBottom: 6 }}>{fmt(p.price)}</div>
                                {p.recipe_count > 0 && (
                                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>🧪 -{p.recipe_count} mat.</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Panier */}
                <div style={{ flex: 1, minWidth: 250, background: 'linear-gradient(145deg,#16102a,#1e1435)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid rgba(224,64,251,0.18)', padding: 20, position: 'sticky', top: 20 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f0e8ff', marginBottom: 16 }}>🛒 Panier</h3>
                  {cart.length === 0 ? (
                    <p style={{ color: '#5a4080', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Aucun article sélectionné.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        {cart.map((item) => (
                          <div key={item.product_id} style={{ background: '#120c22', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(224,64,251,0.1)' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#f0e8ff', marginBottom: 8 }}>{item.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button style={S.qtyBtn2} onClick={() => item.quantity === 1 ? removeFromCart(item.product_id) : setCartQty(item.product_id, item.quantity - 1)}>−</button>
                                <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#f0e8ff' }}>{item.quantity}</span>
                                <button style={S.qtyBtn2} onClick={() => setCartQty(item.product_id, item.quantity + 1)}>+</button>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#e040fb', flex: 1, textAlign: 'right' }}>{fmt(item.price * item.quantity)}</span>
                              <button style={{ background: 'none', border: 'none', color: '#5a4080', cursor: 'pointer', fontSize: 14 }} onClick={() => removeFromCart(item.product_id)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px solid rgba(224,64,251,0.12)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#d0b8f8' }}>
                          <span>Total</span>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#f0e8ff' }}>{fmt(cartTotal)}</span>
                        </div>
                        <button onClick={submitCart} disabled={loading} style={{ ...S.btnPrimary, width: '100%', padding: 12, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
                          {loading ? 'Validation…' : '✅ Valider la facture'}
                        </button>
                        <button onClick={() => setCart([])} style={{ width: '100%', padding: 8, background: 'none', color: '#5a4080', border: '1px solid rgba(224,64,251,0.18)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                          🗑️ Vider le panier
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Historique toutes les factures */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 36, marginBottom: 14, flexWrap: 'wrap' }}>
                <h3 style={{ ...S.subTitle, margin: 0 }}>Historique des factures</h3>
                <input
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  placeholder="🔍 Rechercher par employé, #facture…"
                  style={S.searchInput}
                />
                {invoiceSearch && (
                  <span style={{ fontSize: 13, color: '#8060a0' }}>
                    {invoices.filter(inv => inv.employee_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) || String(inv.id).includes(invoiceSearch)).length} résultat(s)
                  </span>
                )}
              </div>
              {invoices.length === 0 ? (
                <p style={S.empty}>Aucune facture enregistrée.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.filter(inv => !invoiceSearch || inv.employee_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) || String(inv.id).includes(invoiceSearch)).map((inv) => (
                    <div key={inv.id} style={{ background: 'linear-gradient(145deg,#16102a,#1e1435)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(224,64,251,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}
                        onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#f0e8ff', marginRight: 10 }}>Facture #{inv.id}</span>
                          <span style={{ fontSize: 12, color: '#8060a0', marginRight: 8 }}>👤 {inv.employee_name}</span>
                          <span style={{ fontSize: 12, color: '#5a4080' }}>{fmtDate(inv.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#e040fb' }}>{fmt(inv.total_amount)}</span>
                          <button style={{ ...S.btnSmall, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(inv.id); }}>🗑️ Annuler</button>
                          <span style={{ fontSize: 12, color: '#5a4080' }}>{expandedInv === inv.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedInv === inv.id && (
                        <div style={{ padding: '0 18px 14px', borderTop: '1px solid rgba(224,64,251,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {inv.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d0b8f8', paddingTop: 6 }}>
                              <span>{item.product_name} × {item.quantity} ({fmt(item.unit_price)} / unité)</span>
                              <span style={{ fontWeight: 600 }}>{fmt(item.total_amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : ACHATS MATIÈRES PREMIÈRES
          ══════════════════════════════════════════ */}
          {tab === 'achats' && (
            <div>
              <h2 style={S.sectionTitle}>Achats — Matières premières</h2>

              {/* Récap déduction fiscale */}
              {overview && (
                <div style={S.purchaseSummary}>
                  <div style={S.pSumItem}>
                    <div style={S.pSumLabel}>CA du mois</div>
                    <div style={S.pSumValue}>{fmt(overview.totalSales)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#dc2626' }}>
                    <div style={S.pSumLabel}>Achats déduits</div>
                    <div style={{ ...S.pSumValue, color: '#dc2626' }}>− {fmt(overview.totalPurchases)}</div>
                  </div>
                  <div style={{ ...S.pSumItem }}>
                    <div style={S.pSumLabel}>Base imposable</div>
                    <div style={{ ...S.pSumValue, color: '#8060a0' }}>{fmt(overview.taxableBase)}</div>
                  </div>
                  <div style={{ ...S.pSumItem }}>
                    <div style={S.pSumLabel}>💚 Économie impôts estimée</div>
                    <div style={{ ...S.pSumValue, color: '#4ade80' }}>{fmt(overview.taxSaving)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#dc2626' }}>
                    <div style={S.pSumLabel}>🏛️ Impôts dus</div>
                    <div style={{ ...S.pSumValue, color: '#dc2626' }}>{fmt(overview.taxes)}</div>
                  </div>
                </div>
              )}

              {/* Formulaire d'ajout d'achat */}
              <div style={S.formCard}>
                <h3 style={S.subTitle}>➕ Enregistrer un achat</h3>
                <form onSubmit={handleAddPurchase} style={S.formGrid}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Matière première *</label>
                    <select value={acMaterial} onChange={e => {
                      const val = e.target.value;
                      setAcMaterial(val);
                      const rm = rawMaterials.find(m => String(m.id) === String(val));
                      setAcName(rm ? rm.name : '');
                      // Auto-fill prix du lot = prix_unitaire × qté par lot
                      if (rm && rm.unit_price > 0) {
                        const qty = parseFloat(acQty) || 1;
                        setAcPrice(String((rm.unit_price * qty).toFixed(2)));
                      }
                    }} required style={{ ...S.select, borderColor: acMaterial ? '#4ade80' : 'rgba(224,64,251,0.18)', background: acMaterial ? 'rgba(74,222,128,0.06)' : '#0a061a' }}>
                      <option value="">-- Sélectionner une matière première --</option>
                      {rawMaterials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} — {m.unit_price > 0 ? fmt(m.unit_price)+'/'+m.unit : 'prix non défini'} (stock : {m.quantity} {m.unit})</option>
                      ))}
                    </select>
                    {acMaterial && rawMaterials.find(m => String(m.id) === String(acMaterial))?.unit_price > 0 && (
                      <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 4 }}>
                        💡 Prix unitaire enregistré : <strong>{fmt(rawMaterials.find(m => String(m.id) === String(acMaterial))?.unit_price)}/{rawMaterials.find(m => String(m.id) === String(acMaterial))?.unit}</strong> — prix du lot pré-rempli
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Qté par lot *</label>
                    <input type="number" min="0.001" step="0.001" value={acQty} onChange={e => {
                      const newQty = e.target.value;
                      setAcQty(newQty);
                      // Recalcule le prix du lot si la matière a un prix unitaire
                      const rm = rawMaterials.find(m => String(m.id) === String(acMaterial));
                      if (rm && rm.unit_price > 0 && parseFloat(newQty) > 0) {
                        setAcPrice(String((rm.unit_price * parseFloat(newQty)).toFixed(2)));
                      }
                    }} required
                      placeholder="Ex: 24"
                      style={S.input} />
                    {acMaterial && <div style={{ fontSize: 12, color: '#8060a0', marginTop: 4 }}>unité : <strong>{rawMaterials.find(m => String(m.id) === String(acMaterial))?.unit || '—'}</strong></div>}
                  </div>
                  <div>
                    <label style={S.label}>Prix d'un lot ($) *</label>
                    <input type="number" min="0" step="0.01" value={acPrice} onChange={e => setAcPrice(e.target.value)} required placeholder="Ex: 120.00" style={S.input} />
                    {acPrice && acQty && parseFloat(acQty) > 0 && (
                      <div style={{ fontSize: 12, color: '#8060a0', marginTop: 4 }}>
                        → <strong>{fmt(parseFloat(acPrice) / parseFloat(acQty))}</strong> / unité
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Nombre de lots</label>
                    <input type="number" min="1" step="1" value={acLots} onChange={e => setAcLots(e.target.value)} style={S.input} />
                    {acLots && parseInt(acLots) > 1 && acPrice && (
                      <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 4, fontWeight: 600 }}>
                        → Total : <strong>{fmt(parseFloat(acPrice) * parseInt(acLots))}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Notes <span style={{ fontWeight: 400, color: '#5a4080', fontSize: 12 }}>(optionnel)</span></label>
                    <input value={acNotes} onChange={e => setAcNotes(e.target.value)} placeholder="Ex: Fournisseur X, livraison urgente…" style={S.input} />
                  </div>

                  {/* Aperçu du lot */}
                  {acMaterial && acPrice && acQty && parseFloat(acQty) > 0 && (() => {
                    const rm = rawMaterials.find(m => String(m.id) === String(acMaterial));
                    const lots = parseInt(acLots) || 1;
                    const qtyPerLot = parseFloat(acQty || 1);
                    const lotPrice = parseFloat(acPrice || 0);
                    const totalQty = lots * qtyPerLot;
                    const totalCost = lots * lotPrice;
                    const unitPrice = lotPrice / qtyPerLot;
                    return (
                      <div style={{ gridColumn: '1 / -1', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#4ade80', marginBottom: 10 }}>
                          📦 Récapitulatif — {lots > 1 ? `${lots} lots de ${qtyPerLot} ${rm?.unit}` : `1 lot de ${qtyPerLot} ${rm?.unit}`}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                          <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                            <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>MATIÈRE</div>
                            <strong>{rm?.name}</strong>
                          </div>
                          <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                            <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>QTÉ TOTALE AJOUTÉE</div>
                            <strong>+{totalQty} {rm?.unit}</strong>
                          </div>
                          <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                            <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>PRIX / UNITÉ</div>
                            <strong>{fmt(unitPrice)} / {rm?.unit}</strong>
                          </div>
                          {lots > 1 && (
                            <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                              <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>PRIX / LOT</div>
                              <strong>{fmt(lotPrice)}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                            <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>TOTAL À PAYER</div>
                            <strong style={{ fontSize: 16, color: '#4ade80' }}>{fmt(totalCost)}</strong>
                          </div>
                          <div style={{ fontSize: 13, color: '#d0b8f8' }}>
                            <div style={{ color: '#8060a0', fontSize: 11, marginBottom: 2 }}>STOCK APRÈS</div>
                            <strong>{parseFloat(rm?.quantity || 0) + totalQty} {rm?.unit}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={S.btnPrimary} disabled={loading}>
                      {loading ? 'Enregistrement…' : '💾 Enregistrer l\'achat'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Liste des achats du mois */}
              <h3 style={S.subTitle}>Achats du mois en cours</h3>
              {purchasesData.purchases.length === 0 ? (
                <p style={S.empty}>Aucun achat enregistré ce mois-ci.</p>
              ) : (
                <>
                  <div style={{ marginBottom: 12, fontSize: 15, color: '#d0b8f8', fontWeight: 500 }}>
                    Total dépensé ce mois : <strong style={{ color: '#ef4444' }}>{fmt(purchasesData.totalPurchases)}</strong>
                    {overview?.taxSaving > 0 && (
                      <span style={{ color: '#5a4080', marginLeft: 12, fontSize: 13 }}>
                        · Économie impôts estimée : <span style={{ color: '#4ade80', fontWeight: 600 }}>{fmt(overview.taxSaving)}</span>
                      </span>
                    )}
                  </div>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Matière première</th>
                          <th style={S.th}>Qté</th>
                          <th style={S.th}>Prix unit.</th>
                          <th style={S.th}>Total</th>
                          <th style={S.th}>Stock lié</th>
                          <th style={S.th}>Notes</th>
                          <th style={S.th}>Date</th>
                          <th style={S.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchasesData.purchases.map((p) => (
                          <tr key={p.id} style={S.tr}>
                            <td style={S.td}><strong>{p.name}</strong></td>
                            <td style={S.td}>{p.quantity ?? '—'}</td>
                            <td style={S.td}>{fmt(p.unit_price)}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#dc2626' }}>− {fmt(p.total_amount)}</td>
                            <td style={S.td}>
                              {p.material_name
                                ? <span style={{ ...S.badge, background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>🧪 {p.material_name} ({p.material_unit})</span>
                                : <span style={{ color: '#5a4080', fontSize: 12 }}>—</span>
                              }
                            </td>
                            <td style={{ ...S.td, color: '#8060a0', fontSize: 13 }}>{p.notes || '—'}</td>
                            <td style={{ ...S.td, color: '#5a4080', fontSize: 12 }}>{fmtDate(p.purchase_date)}</td>
                            <td style={S.td}>
                              <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeletePurchase(p.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : SALAIRES & IMPÔTS
          ══════════════════════════════════════════ */}
          {tab === 'salaires' && (
            <div>
              <h2 style={S.sectionTitle}>Salaires & Impôts</h2>

              {employees.length === 0 ? <p style={S.loading}>Chargement…</p> : (
                <>
                  {/* ── Salaires à verser cette semaine ── */}
                  <h3 style={S.subTitle}>💸 Salaires à verser — semaine en cours</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
                    {employees.map((emp) => (
                      <div key={emp.id} style={{
                        background: 'linear-gradient(145deg,#16102a,#1e1435)',
                        border: '1px solid rgba(224,64,251,0.15)',
                        borderRadius: 14,
                        padding: '18px 20px',
                        border: `2px solid ${emp.week_salary > 0 ? '#fcd34d' : 'rgba(224,64,251,0.15)'}`,
                        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#f0e8ff' }}>{emp.name}</div>
                            <span style={{ ...S.badge, background: emp.role === 'patron' ? 'rgba(224,64,251,0.15)' : 'rgba(255,255,255,0.05)', color: emp.role === 'patron' ? '#e040fb' : '#8060a0', fontSize: 11 }}>
                              {emp.role === 'patron' ? '👑 Patron' : '👤 Employé'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#5a4080' }}>taux</div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#d0b8f8' }}>{emp.salary_percent}%</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8060a0', marginBottom: 4 }}>
                          <span>CA brut (période)</span>
                          <span style={{ fontWeight: 600, color: '#c0a0d8' }}>{fmt(emp.week_sales)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8060a0', marginBottom: 6 }}>
                          <span>Marge (base salaire)</span>
                          <span style={{ fontWeight: 700, color: '#4ade80' }}>{fmt(emp.week_margin ?? emp.week_sales)}</span>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(224,64,251,0.1)', paddingTop: 10, marginTop: 4 }}>
                          <div style={{ fontSize: 12, color: '#5a4080', marginBottom: 2 }}>Dû depuis le dernier paiement ({emp.salary_percent}% marge)</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: emp.week_salary > 0 ? '#f0a820' : '#5a4080' }}>
                            {fmt(emp.week_salary)}
                          </div>
                        </div>

                        {editingEmployee === emp.id ? (
                          <div style={{ marginTop: 10 }}>
                            <SalaryEditor current={emp.salary_percent} onSave={(v) => handleUpdateSalaryPercent(emp.id, v)} onCancel={() => setEditingEmployee(null)} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button style={{ ...S.btnSmall, flex: 1 }} onClick={() => setEditingEmployee(emp.id)}>✏️ % Salaire</button>
                            {emp.role !== 'patron' && (
                              <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleFireEmployee(emp.id, emp.name)} title="Virer cet employé">🚫</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ── Paiement salaires ───────────────────────────── */}
                  {lastPaidDate && (
                    <div style={{ fontSize: 12, color: '#5a4080', marginBottom: 10 }}>
                      📅 Dernier paiement : <strong style={{ color: '#a080c8' }}>{new Date(lastPaidDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                  )}
                  {/* ────────────────────────────────────────────────── */}
                  {(() => {
                    const totalWeekSal  = employees.reduce((a, e) => a + e.week_salary, 0);
                    const totalMonthSal = employees.reduce((a, e) => a + e.salary_due, 0);
                    const isPaid        = salaryPayment?.isPaid;
                    const paidAmount    = salaryPayment?.paidAmount;
                    const paidAt        = salaryPayment?.paidAt;
                    const history       = salaryPayment?.history ?? [];

                    return (
                      <div style={{ marginBottom: 28 }}>
                        {/* Bloc principal */}
                        <div style={{ background: 'linear-gradient(145deg,#1a1408,#221c08)', border: `2px solid ${isPaid ? '#16a34a' : '#fcd34d'}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>

                            {/* Montant */}
                            <div>
                              <div style={{ fontSize: 12, color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                                💰 Salaires semaine en cours
                              </div>
                              <div style={{ fontSize: 34, fontWeight: 900, color: isPaid ? '#4ade80' : '#fbbf24', lineHeight: 1 }}>
                                {fmt(totalWeekSal)}
                              </div>
                              <div style={{ fontSize: 12, color: '#a08040', marginTop: 4 }}>
                                Total du mois : <strong style={{ color: '#f0e8ff' }}>{fmt(totalMonthSal)}</strong>
                              </div>
                            </div>

                            {/* Bouton ou badge payé */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, justifyContent: 'center' }}>
                              {isPaid ? (
                                <div style={{ background: 'rgba(22,163,74,0.15)', border: '1.5px solid #16a34a', borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>✅ Payés</div>
                                  <div style={{ fontSize: 11, color: '#6a4890', marginTop: 3 }}>
                                    {fmt(paidAmount)} · {new Date(paidAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              ) : totalWeekSal > 0 ? (
                                <button
                                  onClick={handlePaySalaries}
                                  disabled={payingNow}
                                  style={{ padding: '12px 28px', background: payingNow ? '#5a4080' : 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#1a0c00', border: 'none', borderRadius: 10, cursor: payingNow ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 900, boxShadow: '0 4px 20px rgba(251,191,36,0.35)', letterSpacing: 0.3 }}>
                                  {payingNow ? '⏳ Paiement…' : `💸 Payer ${fmt(totalWeekSal)}`}
                                </button>
                              ) : (
                                <div style={{ fontSize: 13, color: '#5a4080' }}>Aucun salaire cette semaine</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Historique des paiements */}
                        {history.length > 0 && (
                          <div>
                            <div style={{ fontSize: 12, color: '#5a4080', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Historique des paiements</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {history.map(p => {
                                const wDate = new Date(p.week_start);
                                return (
                                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '9px 14px', border: '1px solid rgba(22,163,74,0.18)', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ fontSize: 13 }}>
                                      <span style={{ color: '#4ade80', fontWeight: 700 }}>✅ Semaine du </span>
                                      <span style={{ color: '#f0e8ff' }}>{wDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: 14 }}>{fmt(p.total_amount)}</span>
                                      <span style={{ fontSize: 11, color: '#5a4080' }}>
                                        {new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {p.paid_by_name ? ` · ${p.paid_by_name}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Tableau récap mois ── */}
                  <h3 style={S.subTitle}>📊 Récapitulatif du mois</h3>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Employé</th>
                          <th style={S.th}>Rôle</th>
                          <th style={S.th}>CA brut (période)</th>
                          <th style={S.th}>Marge (période)</th>
                          <th style={S.th}>Salaire dû</th>
                          <th style={S.th}>CA brut mois</th>
                          <th style={S.th}>Marge mois</th>
                          <th style={S.th}>Salaire mois</th>
                          <th style={S.th}>% Salaire</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp) => (
                          <tr key={emp.id} style={S.tr}>
                            <td style={S.td}><strong>{emp.name}</strong></td>
                            <td style={S.td}>
                              <span style={{ ...S.badge, background: emp.role === 'patron' ? '#dbeafe' : '#f1f5f9', color: emp.role === 'patron' ? '#1d4ed8' : '#475569' }}>
                                {emp.role === 'patron' ? '👑 Patron' : '👤 Employé'}
                              </span>
                            </td>
                            <td style={S.td}>{fmt(emp.week_sales)}</td>
                            <td style={{ ...S.td, color: '#4ade80', fontWeight: 600 }}>{fmt(emp.week_margin ?? emp.week_sales)}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#d97706' }}>{fmt(emp.week_salary)}</td>
                            <td style={S.td}>{fmt(emp.total_sales)}</td>
                            <td style={{ ...S.td, color: '#4ade80', fontWeight: 600 }}>{fmt(emp.total_margin ?? emp.total_sales)}</td>
                            <td style={{ ...S.td, fontWeight: 600, color: '#7c3aed' }}>{fmt(emp.salary_due)}</td>
                            <td style={S.td}>
                              {editingEmployee === emp.id ? (
                                <SalaryEditor current={emp.salary_percent} onSave={(v) => handleUpdateSalaryPercent(emp.id, v)} onCancel={() => setEditingEmployee(null)} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600 }}>{emp.salary_percent}%</span>
                                  <button style={S.btnSmall} onClick={() => setEditingEmployee(emp.id)}>✏️</button>
                                  {emp.role !== 'patron' && (
                                    <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleFireEmployee(emp.id, emp.name)}>🚫 Virer</button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#0f0820', borderTop: '2px solid rgba(224,64,251,0.2)' }}>
                          <td colSpan={2} style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{fmt(employees.reduce((a, e) => a + e.week_sales, 0))}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#4ade80' }}>{fmt(employees.reduce((a, e) => a + (e.week_margin ?? e.week_sales), 0))}</td>
                          <td style={{ ...S.td, fontWeight: 800, color: '#d97706' }}>{fmt(employees.reduce((a, e) => a + e.week_salary, 0))}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{fmt(employees.reduce((a, e) => a + e.total_sales, 0))}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#4ade80' }}>{fmt(employees.reduce((a, e) => a + (e.total_margin ?? e.total_sales), 0))}</td>
                          <td style={{ ...S.td, fontWeight: 800, color: '#7c3aed' }}>{fmt(employees.reduce((a, e) => a + e.salary_due, 0))}</td>
                          <td style={S.td} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : PRODUITS
          ══════════════════════════════════════════ */}
          {tab === 'produits' && (
            <div>
              <div style={S.sectionHeader}>
                <h2 style={S.sectionTitle}>Gestion des produits</h2>
                <button style={S.btnPrimary} onClick={() => { setShowAddProduct(true); setEditingProduct(null); resetProductForm(); }}>+ Ajouter un produit</button>
              </div>

              {/* Formulaire ajout/modif produit */}
              {(showAddProduct || editingProduct) && (
                <div style={S.formCard}>
                  <h3 style={S.subTitle}>{editingProduct ? '✏️ Modifier le produit' : '➕ Nouveau produit'}</h3>
                  <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} style={S.formGrid}>
                    <div>
                      <label style={S.label}>Nom du produit *</label>
                      <input value={pName} onChange={e => setPName(e.target.value)} required placeholder="Ex: Café expresso" style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Catégorie</label>
                      <input value={pCategory} onChange={e => setPCategory(e.target.value)} placeholder="Ex: Boissons" style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Prix de vente ($) *</label>
                      <input type="number" min="0" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} required placeholder="0" style={S.input} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={S.label}>Image du produit <span style={{ fontWeight: 400, color: '#5a4080', fontSize: 12 }}>(lien URL — ex: goopics, imgur…)</span></label>
                      <input type="url" value={pImageUrl} onChange={e => setPImageUrl(e.target.value)} placeholder="https://i.goopics.net/abc123.png" style={S.input} />
                      {pImageUrl && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img src={pImageUrl} alt="Aperçu" onError={e => e.target.style.display='none'}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(224,64,251,0.2)' }} />
                          <span style={{ fontSize: 12, color: '#8060a0' }}>Aperçu de l'image</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <button type="button" style={S.btnSecondary} onClick={() => { setShowAddProduct(false); setEditingProduct(null); resetProductForm(); }}>Annuler</button>
                      <button type="submit" style={S.btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : (editingProduct ? 'Enregistrer les modifications' : 'Ajouter le produit')}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Liste des produits */}
              {products.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="🔍 Rechercher un produit ou une catégorie…"
                    style={S.searchInput}
                  />
                </div>
              )}
              {products.length === 0 ? (
                <p style={S.empty}>Aucun produit. Ajoutez-en un ci-dessus.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Produit</th>
                        <th style={S.th}>Catégorie</th>
                        <th style={S.th}>Prix vente</th>
                        <th style={S.th}>Coût revient</th>
                        <th style={S.th}>Marge</th>
                        <th style={S.th}>Recette</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.filter(p => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.category?.toLowerCase().includes(productSearch.toLowerCase())).map((p) => {
                        const cp = costPrices.find(c => c.id === p.id);
                        const marginPct = cp?.margin_pct ?? null;
                        const marginColor = marginPct === null ? '#5a4080'
                          : marginPct >= 30 ? '#4ade80'
                          : marginPct >= 10 ? '#fbbf24'
                          : '#ef4444';
                        return (
                        <tr key={p.id} style={{ ...S.tr, background: recipeProduct?.id === p.id ? 'rgba(224,64,251,0.06)' : 'transparent' }}>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(224,64,251,0.2)', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                                : <div style={{ width: 40, height: 40, borderRadius: 8, background: '#120c22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                              }
                              <strong>{p.name}</strong>
                            </div>
                          </td>
                          <td style={S.td}><span style={S.chip}>{p.category}</span></td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{fmt(p.price)}</td>
                          <td style={S.td}>
                            {cp?.cost_price != null
                              ? <span style={{ fontWeight: 600, color: '#d0b8f8' }}>{fmt(cp.cost_price)}</span>
                              : cp?.warning
                              ? <span style={{ fontSize: 11, color: '#fbbf24' }}>⚠️ Prix manquant</span>
                              : <span style={{ color: '#5a4080', fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td style={S.td}>
                            {marginPct != null
                              ? <div>
                                  <span style={{ fontWeight: 700, color: marginColor }}>{marginPct.toFixed(1)}%</span>
                                  <span style={{ fontSize: 11, color: '#8060a0', marginLeft: 6 }}>({fmt(cp.margin)})</span>
                                </div>
                              : <span style={{ color: '#5a4080', fontSize: 12 }}>—</span>
                            }
                          </td>
                          <td style={S.td}>
                            {p.recipe_count > 0
                              ? <span style={{ ...S.badge, background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>🧪 {p.recipe_count} ingr.</span>
                              : <span style={{ ...S.badge, background: 'rgba(255,255,255,0.05)', color: '#5a4080' }}>Aucune</span>
                            }
                          </td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={S.btnSmall} onClick={() => openEditProduct(p)}>✏️ Modifier</button>
                              <button
                                style={{ ...S.btnSmall, background: recipeProduct?.id === p.id ? 'rgba(224,64,251,0.15)' : 'transparent', color: '#e040fb', borderColor: 'rgba(224,64,251,0.3)' }}
                                onClick={() => {
                                  if (recipeProduct?.id === p.id) { setRecipeProduct(null); setRecipe([]); }
                                  else { setRecipeProduct(p); loadRecipe(p.id); }
                                }}
                              >🧪 Recette</button>
                              <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteProduct(p.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Panel de gestion de la recette */}
              {recipeProduct && (
                <div style={{ marginTop: 20, background: 'linear-gradient(145deg,#16102a,#1e1435)', border: '1.5px solid rgba(224,64,251,0.25)', borderRadius: 14, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0e8ff', margin: 0 }}>
                      🧪 Recette de <span style={{ color: '#e040fb' }}>{recipeProduct.name}</span>
                    </h3>
                    <button style={S.btnSmall} onClick={() => { setRecipeProduct(null); setRecipe([]); }}>✕ Fermer</button>
                  </div>

                  <p style={{ fontSize: 13, color: '#8060a0', marginBottom: 16 }}>
                    Définir quelles matières premières (et en quelle quantité) sont consommées pour fabriquer <strong>1 unité</strong> de ce produit. Le stock sera déduit automatiquement à chaque vente.
                  </p>

                  {/* Ingrédients actuels */}
                  {recipe.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {recipe.map((ing) => {
                        const isLow = ing.stock <= ing.min_alert;
                        return (
                          <div key={ing.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#120c22', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(224,64,251,0.15)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 20 }}>🧪</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#f0e8ff' }}>{ing.name}</div>
                                <div style={{ fontSize: 12, color: '#8060a0' }}>
                                  <strong style={{ color: '#e040fb' }}>{ing.quantity_per_unit} {ing.unit}</strong> par unité vendue
                                  {' · '}
                                  <span style={{ color: isLow ? '#ef4444' : '#4ade80', fontWeight: 600 }}>
                                    Stock : {ing.stock} {ing.unit}{isLow ? ' ⚠️' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button style={{ ...S.btnSmall, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => handleDeleteIngredient(ing.id)}>🗑️</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#5a4080', fontSize: 13, marginBottom: 16 }}>Aucun ingrédient défini. Les ventes de ce produit ne déduiront rien du stock.</p>
                  )}

                  {/* Formulaire ajout ingrédient */}
                  <form onSubmit={handleAddIngredient} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 180 }}>
                      <label style={S.label}>Matière première</label>
                      <select value={recipeRm} onChange={e => setRecipeRm(e.target.value)} style={S.select}>
                        <option value="">-- Sélectionner --</option>
                        {rawMaterials
                          .filter(m => !recipe.find(r => r.raw_material_id === m.id))
                          .map(m => <option key={m.id} value={m.id}>{m.name} (stock : {m.quantity} {m.unit})</option>)
                        }
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <label style={S.label}>Quantité par unité vendue</label>
                      <input type="number" min="0.001" step="0.001" value={recipeQty} onChange={e => setRecipeQty(e.target.value)} style={S.input} />
                    </div>
                    {recipeRm && (
                      <div style={{ fontSize: 12, color: '#8060a0', alignSelf: 'flex-end', paddingBottom: 12 }}>
                        unité : <strong>{rawMaterials.find(m => String(m.id) === String(recipeRm))?.unit}</strong>
                      </div>
                    )}
                    <button type="submit" style={{ ...S.btnPrimary, alignSelf: 'flex-end' }}>➕ Ajouter</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : STOCKS (matières premières)
          ══════════════════════════════════════════ */}
          {tab === 'stocks' && (
            <div>
              <h2 style={S.sectionTitle}>Stocks — Matières premières</h2>

              {/* Alertes stock bas */}
              {rawMaterials.filter(m => m.quantity <= m.min_alert).length > 0 && (
                <div style={S.alertBanner}>
                  ⚠️ <strong>{rawMaterials.filter(m => m.quantity <= m.min_alert).length} matière(s) première(s)</strong> en stock bas !
                </div>
              )}

              {/* Formulaire ajout / modification matière première */}
              <div style={S.formCard}>
                <h3 style={S.subTitle}>{editingRm ? '✏️ Modifier la matière première' : '➕ Nouvelle matière première'}</h3>
                <form onSubmit={handleAddRm} style={S.formGrid}>
                  <div>
                    <label style={S.label}>Nom *</label>
                    <input value={rmName} onChange={e => setRmName(e.target.value)} required placeholder="Ex: Café en grains, Lait…" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Unité</label>
                    <input value={rmUnit} onChange={e => setRmUnit(e.target.value)} placeholder="unité, kg, L…" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Prix unitaire ($)</label>
                    <input type="number" min="0" step="0.01" value={rmPrice} onChange={e => setRmPrice(e.target.value)} placeholder="0.00" style={S.input} />
                    <div style={{ fontSize: 11, color: '#8060a0', marginTop: 4 }}>Sera pré-rempli dans les achats</div>
                  </div>
                  {!editingRm && (
                    <div>
                      <label style={S.label}>Stock initial <span style={{ fontWeight: 400, color: '#5a4080', fontSize: 11 }}>(ne débite pas le solde)</span></label>
                      <input type="number" min="0" step="0.01" value={rmQty} onChange={e => setRmQty(e.target.value)} placeholder="0" style={S.input} />
                    </div>
                  )}
                  <div>
                    <label style={S.label}>Seuil d'alerte</label>
                    <input type="number" min="0" step="0.01" value={rmAlert} onChange={e => setRmAlert(e.target.value)} placeholder="5" style={S.input} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    {editingRm && (
                      <button type="button" style={S.btnSecondary} onClick={() => { setEditingRm(null); setRmName(''); setRmUnit('unité'); setRmQty('0'); setRmAlert('5'); setRmPrice('0'); }}>Annuler</button>
                    )}
                    <button type="submit" style={S.btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : (editingRm ? 'Enregistrer' : '➕ Ajouter')}</button>
                  </div>
                </form>
              </div>

              {/* Liste des matières premières */}
              {rawMaterials.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <input
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="🔍 Rechercher une matière première…"
                    style={S.searchInput}
                  />
                </div>
              )}
              {rawMaterials.length === 0 ? (
                <p style={S.empty}>Aucune matière première. Ajoutez-en une ci-dessus.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Matière première</th>
                        <th style={S.th}>Unité</th>
                        <th style={S.th}>Prix / unité</th>
                        <th style={S.th}>Stock actuel</th>
                        <th style={S.th}>Seuil alerte</th>
                        <th style={S.th}>Statut</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterials.filter(m => !stockSearch || m.name?.toLowerCase().includes(stockSearch.toLowerCase())).map((m) => {
                        const isLow = m.quantity <= m.min_alert;
                        return (
                          <tr key={m.id} style={{ ...S.tr, background: isLow ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.015)' }}>
                            <td style={S.td}>
                              <strong style={{ color: isLow ? '#fca5a5' : '#c084fc' }}>{m.name}</strong>
                            </td>
                            <td style={S.td}><span style={S.chip}>{m.unit}</span></td>
                            <td style={S.td}>
                              {m.unit_price > 0
                                ? <span style={{ fontWeight: 700, color: '#fbbf24' }}>{fmt(m.unit_price)}</span>
                                : <span style={{ color: '#5a4080', fontSize: 12 }}>—</span>}
                            </td>
                            <td style={S.td}>
                              {editingRmStock === m.id ? (
                                <StockEditor current={m.quantity} onSave={(v) => handleUpdateRmStock(m.id, v)} onCancel={() => setEditingRmStock(null)} />
                              ) : giftRmId === m.id ? (
                                <form onSubmit={handleGiftStock} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                                  <input type="number" min="0.01" step="0.01" placeholder="Qté reçue" value={giftQty}
                                    onChange={e => setGiftQty(e.target.value)} required
                                    style={{ ...S.input, padding: '5px 8px', fontSize: 13 }} />
                                  <input placeholder="Raison (optionnel)" value={giftLabel}
                                    onChange={e => setGiftLabel(e.target.value)}
                                    style={{ ...S.input, padding: '5px 8px', fontSize: 12 }} />
                                  <div style={{ display: 'flex', gap: 5 }}>
                                    <button type="submit" style={{ ...S.btnSmall, color: '#4ade80', borderColor: '#4ade80' }}>✅</button>
                                    <button type="button" style={S.btnSmall} onClick={() => { setGiftRmId(null); setGiftQty(''); setGiftLabel(''); }}>✕</button>
                                  </div>
                                </form>
                              ) : (
                                <span style={{ fontSize: 16, fontWeight: 800, color: isLow ? '#dc2626' : '#e040fb' }}>{m.quantity}</span>
                              )}
                            </td>
                            <td style={{ ...S.td, color: '#6a4890' }}>{m.min_alert}</td>
                            <td style={S.td}>
                              {m.quantity === 0
                                ? <span style={{ ...S.badge, background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>❌ Épuisé</span>
                                : isLow
                                ? <span style={{ ...S.badge, background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>⚠️ Stock bas</span>
                                : <span style={{ ...S.badge, background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>✅ OK</span>
                              }
                            </td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {editingRmStock !== m.id && giftRmId !== m.id && (
                                  <button style={S.btnSmall} onClick={() => { setEditingRmStock(m.id); setGiftRmId(null); }}>📦 Ajuster</button>
                                )}
                                {giftRmId !== m.id && editingRmStock !== m.id && (
                                  <button style={{ ...S.btnSmall, color: '#4ade80', borderColor: '#4ade80' }}
                                    onClick={() => { setGiftRmId(m.id); setGiftQty(''); setGiftLabel(''); setEditingRmStock(null); }}
                                    title="Ajouter du stock sans créer d'achat (stock donné, stock de départ)">
                                    🎁 Donné
                                  </button>
                                )}
                                <button style={S.btnSmall} onClick={() => { setEditingRm(m); setRmName(m.name); setRmUnit(m.unit); setRmAlert(String(m.min_alert)); setRmPrice(String(m.unit_price ?? 0)); }}>✏️ Modifier</button>
                                <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteRm(m.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Historique des mouvements de stock ── */}
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={S.subTitle}>📋 Historique des mouvements</h3>
                  <button style={S.btnSmall} onClick={() => { setShowMovements(v => !v); if (!showMovements) loadStockMovements(); }}>
                    {showMovements ? '▲ Masquer' : '▼ Afficher'}
                  </button>
                </div>
                {showMovements && (
                  stockMovements.length === 0
                    ? <p style={S.empty}>Aucun mouvement enregistré. Les achats et ventes futurs apparaîtront ici.</p>
                    : <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.th}>Date</th>
                              <th style={S.th}>Matière</th>
                              <th style={S.th}>Type</th>
                              <th style={S.th}>Variation</th>
                              <th style={S.th}>Stock après</th>
                              <th style={S.th}>Détail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockMovements.map(mv => {
                              const isIn  = mv.quantity_change > 0;
                              const typeLabel = {
                                purchase:        { label: '📥 Achat',          color: '#4ade80' },
                                sale:            { label: '📤 Vente',           color: '#ef4444' },
                                adjustment:      { label: '✏️ Ajustement',     color: '#fbbf24' },
                                initial:         { label: '🎁 Stock donné',    color: '#38bdf8' },
                                purchase_cancel: { label: '↩️ Annul. achat',   color: '#f97316' },
                                sale_cancel:     { label: '↩️ Annul. vente',   color: '#a78bfa' },
                              }[mv.movement_type] || { label: mv.movement_type, color: '#8060a0' };
                              return (
                                <tr key={mv.id} style={S.tr}>
                                  <td style={{ ...S.td, fontSize: 12, color: '#5a4080' }}>{fmtDate(mv.created_at)}</td>
                                  <td style={{ ...S.td, fontWeight: 600 }}>{mv.material_name}</td>
                                  <td style={S.td}><span style={{ ...S.badge, background: typeLabel.color + '20', color: typeLabel.color }}>{typeLabel.label}</span></td>
                                  <td style={{ ...S.td, fontWeight: 700, color: isIn ? '#4ade80' : '#ef4444' }}>
                                    {isIn ? '+' : ''}{Number(mv.quantity_change).toFixed(3)} {mv.material_unit}
                                  </td>
                                  <td style={{ ...S.td, color: '#d0b8f8' }}>
                                    {mv.quantity_after != null ? `${Number(mv.quantity_after).toFixed(3)} ${mv.material_unit}` : '—'}
                                  </td>
                                  <td style={{ ...S.td, fontSize: 12, color: '#8060a0', maxWidth: 200 }}>{mv.reference_label || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                )}
              </div>
            </div>
          )}
          {/* ══════════════════════════════════════════
              ONGLET : DEVIS CUSTOM  (garage only)
          ══════════════════════════════════════════ */}
          {tab === 'devis' && (
            <div>
              <h2 style={S.sectionTitle}>🔧 Devis Custom — {session.user.companyName}</h2>
              <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
                {/* ─── Formulaire gauche ─── */}
                <div style={{ flex:'1 1 500px', minWidth:320 }}>
                  {/* Info client */}
                  <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', borderRadius:14, padding:'20px 24px', marginBottom:20, border:'1px solid rgba(224,64,251,0.18)' }}>
                    <div style={{ fontWeight:700, color:'#d0b8f8', marginBottom:14, fontSize:15 }}>👤 Informations client</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>Prénom</div>
                        <input value={devisClient.firstName} onChange={e=>setDevisClient(c=>({...c,firstName:e.target.value}))} placeholder="Prénom" style={S.input} />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>Nom</div>
                        <input value={devisClient.lastName} onChange={e=>setDevisClient(c=>({...c,lastName:e.target.value}))} placeholder="Nom" style={S.input} />
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>Modèle véhicule</div>
                        <input value={devisClient.model} onChange={e=>setDevisClient(c=>({...c,model:e.target.value}))} placeholder="ex: Zentorno" style={S.input} />
                      </div>
                      <div>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>Catégorie</div>
                        <select value={devisClient.category} onChange={e=>setDevisClient(c=>({...c,category:e.target.value}))} style={S.input}>
                          {GARAGE_CATEGORIES.map(cat=>(
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section tabs: perfs / customs / peintures */}
                  <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                    {[['perfs','⚡ Performances'],['customs','🔩 Customs'],['paints','🎨 Peintures']].map(([k,lbl])=>(
                      <button key={k} onClick={()=>setDevisSection(k)}
                        style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:13,
                          background: devisSection===k ? 'linear-gradient(135deg,#7c3aed,#e040fb)' : 'rgba(120,60,180,0.15)',
                          color: devisSection===k ? '#fff' : '#a080c0' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {/* ─ Performances ─ */}
                  {devisSection === 'perfs' && (
                    <div>
                      {Object.entries(GARAGE_PERF_GROUPS).map(([grpLabel, items])=>(
                        <div key={grpLabel} style={{ marginBottom:16 }}>
                          <div style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>{grpLabel}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {items.map(perf=>{
                              const catIdx = GARAGE_CATEGORIES.indexOf(devisClient.category);
                              const price  = GARAGE_PERF_PRICES[perf]?.[catIdx] || 0;
                              const sel    = devisSelPerfs.has(perf);
                              return (
                                <button key={perf} onClick={()=>toggleDevisPerf(perf)}
                                  style={{ padding:'6px 12px', borderRadius:20, border:`1px solid ${sel?'#e040fb':'rgba(120,60,180,0.3)'}`,
                                    background: sel ? 'rgba(224,64,251,0.18)' : 'rgba(30,20,53,0.8)',
                                    color: sel ? '#e040fb' : '#b090d0', cursor:'pointer', fontSize:12, fontWeight:sel?700:400 }}>
                                  {perf} — {price.toLocaleString('fr-FR')}$
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─ Customs ─ */}
                  {devisSection === 'customs' && (
                    <div>
                      {Object.entries(GARAGE_CUSTOM_GROUPS).map(([grpLabel, items])=>(
                        <div key={grpLabel} style={{ marginBottom:16 }}>
                          <div style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>{grpLabel}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {Object.entries(items).map(([item, price])=>{
                              const sel = devisSelCustoms.has(item);
                              return (
                                <button key={item} onClick={()=>toggleDevisCustom(item)}
                                  style={{ padding:'6px 12px', borderRadius:20, border:`1px solid ${sel?'#e040fb':'rgba(120,60,180,0.3)'}`,
                                    background: sel ? 'rgba(224,64,251,0.18)' : 'rgba(30,20,53,0.8)',
                                    color: sel ? '#e040fb' : '#b090d0', cursor:'pointer', fontSize:12, fontWeight:sel?700:400 }}>
                                  {item} — {price.toLocaleString('fr-FR')}$
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─ Peintures ─ */}
                  {devisSection === 'paints' && (
                    <div>
                      {Object.entries(GARAGE_PAINT_GROUPS).map(([grpLabel, items])=>(
                        <div key={grpLabel} style={{ marginBottom:16 }}>
                          <div style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 }}>{grpLabel}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {Object.entries(items).map(([paint, price])=>{
                              const sel = devisSelPaints.has(paint);
                              return (
                                <button key={paint} onClick={()=>toggleDvisPaint(paint)}
                                  style={{ padding:'6px 12px', borderRadius:20, border:`1px solid ${sel?'#e040fb':'rgba(120,60,180,0.3)'}`,
                                    background: sel ? 'rgba(224,64,251,0.18)' : 'rgba(30,20,53,0.8)',
                                    color: sel ? '#e040fb' : '#b090d0', cursor:'pointer', fontSize:12, fontWeight:sel?700:400 }}>
                                  {paint} — {price.toLocaleString('fr-FR')}$
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', letterSpacing:0.6, marginBottom:6 }}>Notes internes</div>
                    <textarea value={devisNotes} onChange={e=>setDevisNotes(e.target.value)} rows={3}
                      placeholder="Remarques, demandes spéciales..."
                      style={{ ...S.input, resize:'vertical', width:'100%', boxSizing:'border-box' }} />
                  </div>
                </div>

                {/* ─── Récap sticky droite ─── */}
                <div style={{ flex:'0 0 300px', position:'sticky', top:80 }}>
                  <div style={{ background:'linear-gradient(145deg,#1e1040,#2a1660)', borderRadius:16, padding:'20px 24px', border:'1px solid rgba(224,64,251,0.25)', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontWeight:800, color:'#e040fb', marginBottom:16, fontSize:16 }}>📋 Récapitulatif</div>

                    {/* Client */}
                    <div style={{ marginBottom:12, paddingBottom:12, borderBottom:'1px solid rgba(120,60,180,0.2)' }}>
                      <div style={{ fontSize:12, color:'#8060a0', marginBottom:4 }}>Client</div>
                      <div style={{ color:'#d0b8f8', fontWeight:600 }}>
                        {devisClient.firstName || devisClient.lastName ? `${devisClient.firstName} ${devisClient.lastName}`.trim() : '—'}
                      </div>
                      <div style={{ fontSize:12, color:'#a080c0' }}>{devisClient.model || '—'} ({devisClient.category})</div>
                    </div>

                    {/* Lignes sélectionnées */}
                    {devisSelPerfs.size > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:4 }}>⚡ Performances</div>
                        {[...devisSelPerfs].map(p=>{
                          const catIdx = GARAGE_CATEGORIES.indexOf(devisClient.category);
                          const price  = GARAGE_PERF_PRICES[p]?.[catIdx] || 0;
                          return <div key={p} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#c0a0e0', marginBottom:2 }}><span>{p}</span><span>{price.toLocaleString('fr-FR')}$</span></div>;
                        })}
                      </div>
                    )}
                    {devisSelCustoms.size > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:4 }}>🔩 Customs</div>
                        {[...devisSelCustoms].map(c=>(
                          <div key={c} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#c0a0e0', marginBottom:2 }}><span>{c}</span><span>{(GARAGE_CUSTOM_PRICES[c]||0).toLocaleString('fr-FR')}$</span></div>
                        ))}
                      </div>
                    )}
                    {devisSelPaints.size > 0 && (
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:4 }}>🎨 Peintures</div>
                        {[...devisSelPaints].map(p=>{
                          let pr=0; for(const g of Object.values(GARAGE_PAINT_GROUPS)){if(g[p]){pr=g[p];break;}}
                          return <div key={p} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#c0a0e0', marginBottom:2 }}><span>{p}</span><span>{pr.toLocaleString('fr-FR')}$</span></div>;
                        })}
                      </div>
                    )}

                    {/* Total */}
                    <div style={{ borderTop:'1px solid rgba(120,60,180,0.3)', paddingTop:12, marginTop:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#a080c0', marginBottom:4 }}>
                        <span>Prix client</span>
                        <span>{devisGrandTotal.toLocaleString('fr-FR')}$</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#f87171', marginBottom:4 }}>
                        <span>— Coût pièces</span>
                        <span>-{devisPartsTotal.toLocaleString('fr-FR')}$</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:18, color:'#e040fb', borderTop:'1px solid rgba(120,60,180,0.2)', paddingTop:8, marginTop:4 }}>
                        <span>MARGE NETTE</span>
                        <span>{devisMargin.toLocaleString('fr-FR')}$</span>
                      </div>
                    </div>

                    {/* Boutons */}
                    <button onClick={submitDevis} disabled={devisLoading}
                      style={{ width:'100%', marginTop:16, padding:'12px 0', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:14,
                        background:'linear-gradient(135deg,#7c3aed,#e040fb)', color:'#fff', opacity:devisLoading?0.6:1 }}>
                      {devisLoading ? '⏳ Envoi...' : '✅ Valider le devis'}
                    </button>
                    <button onClick={resetDevis}
                      style={{ width:'100%', marginTop:8, padding:'10px 0', borderRadius:10, border:'1px solid rgba(120,60,180,0.3)', cursor:'pointer', fontWeight:600, fontSize:13,
                        background:'transparent', color:'#a080c0' }}>
                      🗑️ Réinitialiser
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : REGISTRE  (garage only)
          ══════════════════════════════════════════ */}
          {tab === 'registre' && (() => {
            const now = new Date();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const filteredQuotes = garageQuotes.filter(q => {
              const d = new Date(q.created_at);
              if (registreFilter === 'week')  return d >= weekStart;
              if (registreFilter === 'month') return d >= monthStart;
              return true;
            });
            return (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:20 }}>
                <h2 style={{ ...S.sectionTitle, marginBottom:0 }}>📋 Registre des clients — {session.user.companyName}</h2>
                <div style={{ display:'flex', gap:8 }}>
                  {[['all','Tout'],['week','Cette semaine'],['month','Ce mois']].map(([v,l])=>(
                    <button key={v} onClick={()=>setRegistreFilter(v)}
                      style={{ padding:'6px 14px', borderRadius:20, border: registreFilter===v?'2px solid #e040fb':'1px solid rgba(224,64,251,0.2)', background: registreFilter===v?'rgba(224,64,251,0.15)':'rgba(255,255,255,0.03)', color: registreFilter===v?'#f0e8ff':'#6a4890', fontSize:13, fontWeight:registreFilter===v?700:500, cursor:'pointer', transition:'all 0.15s' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {filteredQuotes.length === 0 ? (
                <div style={{ textAlign:'center', color:'#8060a0', padding:60, fontSize:15 }}>Aucun devis pour cette période</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {filteredQuotes.map(q=>{
                    const isOpen = expandedQuote === q.id;
                    return (
                      <div key={q.id} style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', borderRadius:12, border:'1px solid rgba(224,64,251,0.15)', overflow:'hidden' }}>
                        {/* Header row */}
                        <div onClick={()=>setExpandedQuote(isOpen ? null : q.id)}
                          style={{ display:'flex', alignItems:'center', padding:'14px 20px', cursor:'pointer', gap:16 }}>
                          <div style={{ flex:1 }}>
                            <span style={{ fontWeight:700, color:'#d0b8f8', fontSize:15 }}>{q.client_first_name} {q.client_last_name}</span>
                            <span style={{ marginLeft:12, fontSize:12, color:'#8060a0' }}>{q.vehicle_model} ({q.vehicle_category})</span>
                          </div>
                          <div style={{ fontWeight:800, color:'#e040fb', fontSize:16 }}>{Number(q.grand_total).toLocaleString('fr-FR')}$</div>
                          <div style={{ fontSize:12, color:'#8060a0', minWidth:80, textAlign:'right' }}>{new Date(q.created_at).toLocaleDateString('fr-FR')}</div>
                          <div style={{ color:'#8060a0', fontSize:18 }}>{isOpen ? '▲' : '▼'}</div>
                        </div>
                        {/* Expanded details */}
                        {isOpen && (
                          <div style={{ padding:'0 20px 16px', borderTop:'1px solid rgba(120,60,180,0.2)' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14 }}>
                              {/* Perfs */}
                              <div>
                                <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:6 }}>⚡ Performances</div>
                                {(q.selected_performances||[]).length === 0
                                  ? <div style={{ color:'#604080', fontSize:12 }}>Aucune</div>
                                  : (q.selected_performances||[]).map((p,i)=>(
                                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#c0a0e0', marginBottom:2 }}>
                                      <span>{p.type}</span><span>{Number(p.price).toLocaleString('fr-FR')}$</span>
                                    </div>
                                  ))}
                                <div style={{ marginTop:6, fontWeight:700, color:'#d0b8f8', fontSize:13 }}>Sous-total: {Number(q.perfs_total).toLocaleString('fr-FR')}$</div>
                              </div>
                              {/* Customs */}
                              <div>
                                <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:6 }}>🔩 Customs</div>
                                {(q.selected_customs||[]).length === 0
                                  ? <div style={{ color:'#604080', fontSize:12 }}>Aucun</div>
                                  : (q.selected_customs||[]).map((c,i)=>(
                                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#c0a0e0', marginBottom:2 }}>
                                      <span>{c.type}</span><span>{Number(c.price).toLocaleString('fr-FR')}$</span>
                                    </div>
                                  ))}
                                <div style={{ marginTop:6, fontWeight:700, color:'#d0b8f8', fontSize:13 }}>Sous-total: {Number(q.customs_total).toLocaleString('fr-FR')}$</div>
                              </div>
                              {/* Peintures */}
                              <div>
                                <div style={{ fontSize:11, color:'#8060a0', textTransform:'uppercase', marginBottom:6 }}>🎨 Peintures</div>
                                {(q.selected_paints||[]).length === 0
                                  ? <div style={{ color:'#604080', fontSize:12 }}>Aucune</div>
                                  : (q.selected_paints||[]).map((p,i)=>(
                                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#c0a0e0', marginBottom:2 }}>
                                      <span>{p.type}</span><span>{Number(p.price).toLocaleString('fr-FR')}$</span>
                                    </div>
                                  ))}
                                <div style={{ marginTop:6, fontWeight:700, color:'#d0b8f8', fontSize:13 }}>Sous-total: {Number(q.paints_total).toLocaleString('fr-FR')}$</div>
                              </div>
                            </div>
                            {q.notes && (
                              <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(120,60,180,0.08)', borderRadius:8, fontSize:12, color:'#a080c0' }}>
                                📝 {q.notes}
                              </div>
                            )}
                            <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <div style={{ fontSize:12, color:'#604080' }}>
                                Employé: {q.employee_name || '—'} · Enregistré le {new Date(q.created_at).toLocaleString('fr-FR')}
                              </div>
                              <button onClick={e => { e.stopPropagation(); deleteQuote(q.id); }}
                                style={{ padding:'5px 14px', borderRadius:8, border:'1px solid rgba(220,50,50,0.4)', background:'rgba(220,50,50,0.1)', color:'#f87171', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                                🗑️ Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {/* ══════════════════════════════════════════
              ONGLET : MON COMPTE
          ══════════════════════════════════════════ */}
          {tab === 'compte' && (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <h2 style={S.sectionTitle}>⚙️ Mon compte</h2>

              {/* Infos */}
              <div style={{ background: 'linear-gradient(145deg,#16102a,#1e1435)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, border: '1px solid rgba(224,64,251,0.18)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 11, color: '#8060a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Nom affiché</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f0e8ff', marginBottom: 18 }}>{session.user.name}</div>
                <div style={{ fontSize: 11, color: '#8060a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Identifiant de connexion</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e040fb', marginBottom: 18 }}>@{session.user.username}</div>
                <div style={{ fontSize: 11, color: '#8060a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Entreprise</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#d0b8f8' }}>{session.user.companyName}</div>
              </div>

              {/* Formulaire changement mdp */}
              <div style={{ background: 'linear-gradient(145deg,#16102a,#1e1435)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(224,64,251,0.18)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0e8ff', marginBottom: 16 }}>🔒 Changer mon mot de passe</h3>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={S.label}>Mot de passe actuel</label>
                    <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required placeholder="••••••••" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Nouveau mot de passe <span style={{ fontWeight: 400, color: '#5a4080', fontSize: 12 }}>(6 car. min.)</span></label>
                    <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required minLength={6} placeholder="••••••••" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Confirmer le nouveau mot de passe</label>
                    <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required placeholder="••••••••"
                      style={{ ...S.input, borderColor: cpConfirm && cpNew !== cpConfirm ? '#ef4444' : 'rgba(224,64,251,0.18)' }} />
                    {cpConfirm && cpNew !== cpConfirm && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Les mots de passe ne correspondent pas.</div>
                    )}
                  </div>
                  <button type="submit" disabled={cpLoading || Boolean(cpConfirm && cpNew !== cpConfirm)}
                    style={{ ...S.btnPrimary, opacity: cpLoading ? 0.6 : 1 }}>
                    {cpLoading ? 'Modification…' : '🔒 Modifier le mot de passe'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}

// ─── Sous-composants ─────────────────────────────────────────
function StockEditor({ current, onSave, onCancel }) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: 70, padding: '5px 9px', border: '1.5px solid rgba(224,64,251,0.35)', borderRadius: 7, fontSize: 14, background: '#0a061a', color: '#f0e8ff' }} />
      <button style={{ ...S.btnSmall, background: 'linear-gradient(135deg,#b020d0,#f060ff)', color: '#fff', borderColor: 'transparent' }} onClick={() => onSave(val)}>✓</button>
      <button style={S.btnSmall} onClick={onCancel}>✕</button>
    </div>
  );
}

// ── Barre barème fiscal ───────────────────────────────────────
function TaxBracketBar({ net, rate, bracket }) {
  const brackets = [
    { label: '0 %',  min: 0,     max: 14999,  color: '#16a34a' },
    { label: '10 %', min: 15000, max: 30999,  color: '#f59e0b' },
    { label: '20 %', min: 31000, max: 50999,  color: '#f97316' },
    { label: '30 %', min: 51000, max: 100000, color: '#dc2626' },
  ];
  const maxVal = 100000;
  const clampedNet = Math.min(net, maxVal);

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
        {brackets.map((b, i) => {
          const width = ((b.max - b.min + 1) / maxVal) * 100;
          const active = net >= b.min && (i === brackets.length - 1 ? net >= b.min : net <= b.max);
          return (
            <div key={i} style={{ width: `${width}%`, background: active ? b.color : b.color + '33', transition: 'background 0.3s' }} title={`${b.label} — ${b.min.toLocaleString('fr-FR')} à ${b.max.toLocaleString('fr-FR')}`} />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#5a4080', display: 'flex', justifyContent: 'space-between' }}>
        <span>$0</span><span>$15k</span><span>$31k</span><span>$51k</span><span>$100k+</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: rate === 0 ? '#16a34a' : '#dc2626' }}>
        Tranche active : {bracket}
      </div>
    </div>
  );
}

function SalaryEditor({ current, onSave, onCancel }) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min="0" max="100" step="0.5" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: 70, padding: '5px 9px', border: '1.5px solid rgba(224,64,251,0.35)', borderRadius: 7, fontSize: 14, background: '#0a061a', color: '#f0e8ff' }} />
      <span style={{ color: '#a080c0', fontWeight: 600 }}>%</span>
      <button style={{ ...S.btnSmall, background: 'linear-gradient(135deg,#b020d0,#f060ff)', color: '#fff', borderColor: 'transparent' }} onClick={() => onSave(val)}>✓</button>
      <button style={S.btnSmall} onClick={onCancel}>✕</button>
    </div>
  );
}

// ─── Styles — Design System v2 ────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#080614', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },
  loadingPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080614' },
  spinner: { width: 44, height: 44, border: '4px solid #2a1050', borderTop: '4px solid #e040fb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  toast: { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '13px 22px', borderRadius: 12, color: '#fff', fontWeight: 600, fontSize: 15, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' },

  // ── Barre de recherche
  searchInput: {
    width: '100%',
    maxWidth: 420,
    padding: '10px 14px',
    border: '1.5px solid rgba(224,64,251,0.18)',
    borderRadius: 9,
    fontSize: 14,
    color: '#f0e8ff',
    background: 'rgba(255,255,255,0.03)',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: "'Segoe UI', system-ui, Arial, sans-serif",
  },

  // ── Navigation cosmique
  nav: {},
  navLeft: {},
  navRight: {},
  navLogo: {},
  navCompany: {},
  navUser: {},
  navBtn: {},

  main: {},
  sectionTitle: { fontSize: 22, fontWeight: 700, color: '#f0e8ff', marginBottom: 20, letterSpacing: -0.3 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 },
  subTitle: { fontSize: 12, fontWeight: 700, color: '#8060a0', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 },
  loading: { color: '#5a4080', fontStyle: 'italic' },
  empty: {
    color: '#5a4080', textAlign: 'center', padding: '48px 24px',
    background: 'rgba(255,255,255,0.015)', borderRadius: 16,
    border: '1px dashed rgba(224,64,251,0.12)',
    fontSize: 15,
  },

  // ── KPI cards — surface violet sombre avec halo rose
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard: {
    background: 'linear-gradient(145deg, #16102a, #1e1435)',
    borderRadius: 16, padding: '20px 18px',
    border: '1px solid rgba(224,64,251,0.15)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
  },
  kpiIcon: { fontSize: 30, marginBottom: 10 },
  kpiLabel: { fontSize: 12, color: '#6a4890', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 },
  kpiValue: { fontSize: 30, fontWeight: 800, color: '#f0e8ff', letterSpacing: -0.5 },

  alertBanner: {
    background: 'rgba(224,64,251,0.06)',
    border: '1px solid rgba(224,64,251,0.25)',
    borderRadius: 12, padding: '12px 18px', marginBottom: 18,
    color: '#e080ff', fontSize: 14, fontWeight: 500,
    backdropFilter: 'blur(8px)',
  },
  alertLink: { background: 'none', border: 'none', color: '#f060ff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: 14 },

  taxBox: {
    background: '#120c22', border: '1px solid rgba(224,64,251,0.18)',
    borderRadius: 14, padding: '20px 24px', marginBottom: 24,
    display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  taxRow: { display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c0a0d8' },

  // ── Tableaux cosmiques
  tableWrap: { overflowX: 'auto', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(224,64,251,0.12)' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#0e0a1e', minWidth: 500 },
  th: {
    background: 'rgba(0,0,0,0.4)', padding: '11px 14px', textAlign: 'left',
    fontSize: 11, fontWeight: 700, color: '#7060a0',
    textTransform: 'uppercase', letterSpacing: 0.8,
    borderBottom: '1px solid rgba(224,64,251,0.15)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 14px', fontSize: 14, color: '#c0a0d8', verticalAlign: 'middle' },

  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  chip: { background: 'rgba(224,64,251,0.12)', color: '#e040fb', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 500 },

  // ── Boutons rose magenta lumineux
  btnPrimary: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #7c3aed, #9f67fa)',
    color: '#fff', border: 'none', borderRadius: 9,
    cursor: 'pointer', fontSize: 14, fontWeight: 700,
    transition: 'opacity 0.15s',
  },
  btnSecondary: {
    padding: '8px 18px', background: 'rgba(255,255,255,0.06)',
    color: '#c084fc', border: '1px solid rgba(224,64,251,0.25)',
    borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  btnSmall: {
    padding: '5px 12px', fontSize: 12, fontWeight: 600,
    background: 'rgba(255,255,255,0.04)', color: '#c084fc',
    border: '1px solid rgba(224,64,251,0.2)', borderRadius: 7, cursor: 'pointer',
  },
  btnApprove: {
    padding: '7px 16px', fontSize: 13, fontWeight: 700,
    background: 'rgba(74,222,128,0.12)', color: '#4ade80',
    border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, cursor: 'pointer',
  },
  btnReject: {
    padding: '7px 16px', fontSize: 13, fontWeight: 700,
    background: 'rgba(220,38,38,0.1)', color: '#f87171',
    border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, cursor: 'pointer',
  },

  formCard: {
    background: 'linear-gradient(145deg, #0e0820, #160d30)',
    border: '1px solid rgba(224,64,251,0.15)',
    borderRadius: 14, padding: '22px 24px', marginBottom: 24,
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16, alignItems: 'start',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#8060a0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%', padding: '9px 13px', borderRadius: 9, fontSize: 14,
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(224,64,251,0.2)',
    color: '#f0e8ff', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%', padding: '9px 13px', borderRadius: 9, fontSize: 14,
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(224,64,251,0.2)',
    color: '#f0e8ff', outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
  },
  qtyBtn2: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(224,64,251,0.25)',
    background: 'rgba(224,64,251,0.08)', color: '#e040fb',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  purchaseSummary: {
    display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24,
    background: 'linear-gradient(145deg,#120c22,#1a1030)',
    border: '1px solid rgba(224,64,251,0.18)',
    borderRadius: 14, padding: '18px 22px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  },
  pSumItem:  { flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 4 },
  pSumLabel: { fontSize: 12, color: '#6a4890', marginBottom: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  pSumValue: { fontSize: 24, fontWeight: 800, color: '#f0e8ff', letterSpacing: -0.3 },

  pendingList:    { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 },
  pendingBox:     { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '16px 18px' },
  pendingRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  pendingInfo:    { display: 'flex', flexDirection: 'column', gap: 4 },
  pendingTitle:   { fontSize: 15, fontWeight: 700, color: '#f0e8ff' },
  pendingEmail:   { fontSize: 13, color: '#8060a0' },
  pendingDate:    { fontSize: 12, color: '#5a4080', marginTop: 2 },
  pendingActions: { display: 'flex', gap: 8, alignItems: 'center' },
};
