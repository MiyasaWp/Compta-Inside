import Head from 'next/head';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo, useCallback } from 'react';

const CATEGORIES = ['Compacts','Sedans','Coupés','Motos','Muscle','SUV','Sport','Sports classic','Super'];

// Mapping clé perf → index dans les tableaux du JSON véhicule
const VEHICLE_PERF_MAP = {
  'Moteur 1':{k:'M',i:0},'Moteur 2':{k:'M',i:1},'Moteur 3':{k:'M',i:2},'Moteur 4':{k:'M',i:3},'Moteur 5':{k:'M',i:4},
  'Turbo':{k:'T',i:null},
  'Transmission 1':{k:'Tr',i:0},'Transmission 2':{k:'Tr',i:1},'Transmission 3':{k:'Tr',i:2},'Transmission 4':{k:'Tr',i:3},
  'Freins 1':{k:'F',i:0},'Freins 2':{k:'F',i:1},'Freins 3':{k:'F',i:2},'Freins 4':{k:'F',i:3},
  'Suspensions 1':{k:'S',i:0},'Suspensions 2':{k:'S',i:1},'Suspensions 3':{k:'S',i:2},
};
const PERF_PRICES = {
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
const PERF_GROUPS = {
  '🔧 Moteur':['Moteur 1','Moteur 2','Moteur 3','Moteur 4','Moteur 5','Turbo'],
  '⚙️ Transmission':['Transmission 1','Transmission 2','Transmission 3','Transmission 4'],
  '🛑 Freins':['Freins 1','Freins 2','Freins 3','Freins 4'],
  '🔩 Suspensions':['Suspensions 1','Suspensions 2','Suspensions 3'],
};
const CUSTOM_PRICES = {
  'Aileron':1500,'Bas de caisse':1200,'Pare-choc AV':1500,'Pare-choc AR':1500,
  'Échappement':800,'Arceaux de sécurité':800,'Grille':800,'Capot':1000,
  'Aile gauche':700,'Aile droite':700,'Toit':850,'Contour de plaque':400,
  'Calandre':400,'Néon intérieur':400,'Coffre':400,'Hydraulique':400,
  'Bloc moteur':400,'Filtre à air':400,'Accessoires':400,'Caches-roues':400,
  'Antennes':400,'Ailes':750,'Réservoir':400,'Fenêtre':400,'Rétroviseur':400,
  'Light bar':400,'Klaxon':150,'Phares':650,'Roues':900,'Vitres':900,
  'Intérieur':450,'Plaques':450,'Extra':1000,
};
const PAINT_GROUPS = {
  '🎨 Peinture principale':{'Principale - Normale':500,'Principale - Métallique':750,'Principale - Pearl':750,'Principale - Matte':850,'Principale - Metal':850,'Principale - Chrome':1200},
  '🖌️ Peinture secondaire':{'Secondaire - Normale':500,'Secondaire - Métallique':750,'Secondaire - Pearl':750,'Secondaire - Matte':850,'Secondaire - Metal':850,'Secondaire - Chrome':1200},
  '✨ Finitions':{'Nacrage':700,'Motifs':1000,'Stickers':1000,'Couleurs intérieur':500,'Couleurs tableau de bord':500},
};
const EXPENSE_CATS = ['Pièces','Outillage','Fournitures','Loyer','Autre'];

const fmt  = (n) => '$' + Number(n||0).toLocaleString('fr-CA',{maximumFractionDigits:0});
const fmtD = (d) => d ? new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—';

export default function GarageDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Overview ─────────────────────────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [newBalanceVal, setNewBalanceVal] = useState('');

  // ── Données véhicules ─────────────────────────────────────────────
  const [vehicleData, setVehicleData] = useState(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null); // spawn ID
  const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);

  useEffect(()=>{
    fetch('/vehicle_prices.json').then(r=>r.json()).then(d=>setVehicleData(d)).catch(()=>{});
  },[]);

  // Recherche véhicule
  const vehicleSuggestions = useMemo(()=>{
    if (!vehicleData || vehicleSearch.length < 2) return [];
    const q = vehicleSearch.toLowerCase();
    return Object.entries(vehicleData)
      .filter(([id,v])=> id.includes(q) || v.n.toLowerCase().includes(q))
      .slice(0,12)
      .map(([id,v])=>({id, name:v.n, cat:v.c}));
  },[vehicleData, vehicleSearch]);

  // Prix d'une perf pour le véhicule sélectionné (ou fallback catégorie)
  const getVehiclePrice = useCallback((perfKey) => {
    const m = VEHICLE_PERF_MAP[perfKey];
    if (!m) return null;
    const vd = selectedVehicle && vehicleData?.[selectedVehicle];
    if (!vd) return null;
    if (m.k === 'T') return vd.u?.T ?? null;
    const arr = vd.u?.[m.k];
    if (!arr) return null;
    return arr[m.i] ?? null;
  },[selectedVehicle, vehicleData]);

  // ── Devis builder ─────────────────────────────────────────────────
  const [client, setClient] = useState({firstName:'',lastName:'',model:'',category:'Sport'});
  const [selPerfs, setSelPerfs]     = useState(new Set());
  const [selCustoms, setSelCustoms] = useState(new Set());
  const [selPaints, setSelPaints]   = useState(new Set());
  const [devisNotes, setDevisNotes] = useState('');
  const [activeSection, setActiveSection] = useState('perfs');

  // ── Registre ──────────────────────────────────────────────────────
  const [quotes, setQuotes]           = useState([]);
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [registreFilter, setRegistreFilter] = useState('all'); // 'all' | 'week' | 'month'

  // ── Dépenses ──────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [newExp, setNewExp]     = useState({description:'',amount:'',category:'Pièces',expense_date:new Date().toISOString().slice(0,10),notes:''});

  // ── Employés ──────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([]);
  const [lastPaid, setLastPaid]   = useState(null);
  const [salaryInfo, setSalaryInfo] = useState(null);
  const [payingNow, setPayingNow]   = useState(false);

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  useEffect(() => { if (status==='unauthenticated') router.replace('/'); },[status,router]);

  const loadOverview  = useCallback(async () => { const r=await fetch('/api/garage/overview'); if(r.ok){const d=await r.json();setOverview(d);} },[]);
  const loadQuotes    = useCallback(async () => { const r=await fetch('/api/garage/devis'); if(r.ok){const d=await r.json();setQuotes(d.quotes||[]);} },[]);
  const loadExpenses  = useCallback(async () => { const r=await fetch('/api/garage/expenses'); if(r.ok){const d=await r.json();setExpenses(d.expenses||[]);} },[]);
  const loadEmployees = useCallback(async () => {
    const [re,rs] = await Promise.all([fetch('/api/garage/employees'),fetch('/api/garage/salary-payment')]);
    if(re.ok){const d=await re.json();setEmployees(d.employees||[]);setLastPaid(d.lastPaid);}
    if(rs.ok){const d=await rs.json();setSalaryInfo(d);}
  },[]);

  useEffect(()=>{ if(tab==='overview') loadOverview(); },[tab]);
  useEffect(()=>{ if(tab==='registre') loadQuotes(); },[tab]);
  useEffect(()=>{ if(tab==='depenses') loadExpenses(); },[tab]);
  useEffect(()=>{ if(tab==='employes') loadEmployees(); },[tab]);

  // ── Totaux devis ──────────────────────────────────────────────────
  const catIdx = CATEGORIES.indexOf(client.category);
  const perfPrice = useCallback((p) => {
    const vp = getVehiclePrice(p);
    if (vp != null) return vp;
    return PERF_PRICES[p]?.[catIdx] || 0;
  },[getVehiclePrice, catIdx]);
  const perfsTotal   = useMemo(()=>{let t=0;selPerfs.forEach(p=>{t+=perfPrice(p);});return t;},[selPerfs,perfPrice]);
  const customsTotal = useMemo(()=>{let t=0;selCustoms.forEach(c=>{t+=(CUSTOM_PRICES[c]||0);});return t;},[selCustoms]);
  const paintsTotal  = useMemo(()=>{let t=0;selPaints.forEach(p=>{for(const g of Object.values(PAINT_GROUPS)){if(g[p]){t+=g[p];break;}}});return t;},[selPaints]);
  const grandTotal   = perfsTotal+customsTotal+paintsTotal;

  const togglePerf   = (p) => setSelPerfs(s=>{const n=new Set(s);n.has(p)?n.delete(p):n.add(p);return n;});
  const toggleCustom = (c) => setSelCustoms(s=>{const n=new Set(s);n.has(c)?n.delete(c):n.add(c);return n;});
  const togglePaint  = (p) => setSelPaints(s=>{const n=new Set(s);n.has(p)?n.delete(p):n.add(p);return n;});
  const resetDevis   = () => { setClient({firstName:'',lastName:'',model:'',category:'Sport'}); setSelPerfs(new Set()); setSelCustoms(new Set()); setSelPaints(new Set()); setDevisNotes(''); setActiveSection('perfs'); setSelectedVehicle(null); setVehicleSearch(''); };
  // ── Custom devis builder (client séparé) ─────────────────────────
  const [clientCustom, setClientCustom] = useState({firstName:'',lastName:'',model:'',category:'Sport'});
  const [activeCustomSection, setActiveCustomSection] = useState('customs');
  const [customNotes, setCustomNotes]   = useState('');
  const resetCustomDevis = () => { setClientCustom({firstName:'',lastName:'',model:'',category:'Sport'}); setSelCustoms(new Set()); setSelPaints(new Set()); setCustomNotes(''); setActiveCustomSection('customs'); };

  const submitDevis = async () => {
    if (!client.firstName && !client.lastName) return showToast('Indiquez un nom client',false);
    setLoading(true);
    const r = await fetch('/api/garage/devis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      clientFirstName:client.firstName, clientLastName:client.lastName, vehicleModel:client.model, vehicleCategory:client.category, vehicleSpawnId:selectedVehicle||'',
      selectedPerformances:[...selPerfs].map(p=>({type:p,price:perfPrice(p)})),
      selectedCustoms:[...selCustoms].map(c=>({type:c,price:CUSTOM_PRICES[c]||0})),
      selectedPaints:[...selPaints].map(p=>{let price=0;for(const g of Object.values(PAINT_GROUPS)){if(g[p]){price=g[p];break;}}return{type:p,price};}),
      perfsTotal,customsTotal,paintsTotal,grandTotal,notes:devisNotes,
    })});
    setLoading(false);
    if(r.ok){showToast('Devis enregistré !');resetDevis();loadOverview();}
    else showToast('Erreur enregistrement',false);
  };

  const submitCustomDevis = async () => {
    if (!clientCustom.firstName && !clientCustom.lastName) return showToast('Indiquez un nom client',false);
    if (customsTotal+paintsTotal===0) return showToast('Aucun article sélectionné',false);
    setLoading(true);
    const r = await fetch('/api/garage/devis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      clientFirstName:clientCustom.firstName, clientLastName:clientCustom.lastName,
      vehicleModel:clientCustom.model, vehicleCategory:clientCustom.category, vehicleSpawnId:'',
      selectedPerformances:[],
      selectedCustoms:[...selCustoms].map(c=>({type:c,price:CUSTOM_PRICES[c]||0})),
      selectedPaints:[...selPaints].map(p=>{let price=0;for(const g of Object.values(PAINT_GROUPS)){if(g[p]){price=g[p];break;}}return{type:p,price};}),
      perfsTotal:0,customsTotal,paintsTotal,grandTotal:customsTotal+paintsTotal,notes:customNotes,
    })});
    setLoading(false);
    if(r.ok){showToast('Devis enregistré !');resetCustomDevis();loadOverview();}
    else showToast('Erreur enregistrement',false);
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    if(!newExp.description||!newExp.amount) return showToast('Description et montant requis',false);
    const r = await fetch('/api/garage/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newExp)});
    if(r.ok){showToast('Dépense ajoutée !');setNewExp({description:'',amount:'',category:'Pièces',expense_date:new Date().toISOString().slice(0,10),notes:''});loadExpenses();loadOverview();}
    else showToast('Erreur',false);
  };

  const deleteExpense = async (id) => {
    await fetch(`/api/garage/expenses?id=${id}`,{method:'DELETE'});
    loadExpenses(); loadOverview();
  };

  const handlePaySalaries = async () => {
    if(!salaryInfo||salaryInfo.totalToPay<=0) return;
    setPayingNow(true);
    const r = await fetch('/api/garage/salary-payment',{method:'POST'});
    setPayingNow(false);
    if(r.ok){showToast('Salaires payés !');loadEmployees();loadOverview();}
    else showToast('Erreur paiement',false);
  };

  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    const r = await fetch('/api/garage/balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({balance:parseFloat(newBalanceVal)})});
    if(r.ok){setEditingBalance(false);loadOverview();showToast('Solde mis à jour !');}
  };

  if (status==='loading') return <div style={{background:'#0a061a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#8060a0',fontFamily:'system-ui'}}>Chargement…</div>;
  if (!session) return null;

  const TABS=[
    {key:'overview',    label:'📊 Vue d\'ensemble'},
    {key:'devis-perf',  label:'🔧 Devis Perf'},
    {key:'devis-custom',label:'🎨 Devis Custom'},
    {key:'registre',    label:'📋 Registre'},
    {key:'depenses',    label:'🛒 Dépenses'},
    {key:'employes',    label:'👥 Employés'},
    {key:'compte',      label:'👤 Mon Compte'},
  ];

  // ── Styles communs ────────────────────────────────────────────────
  const card = {background:'linear-gradient(145deg,#16102a,#1e1435)',border:'1px solid rgba(224,64,251,0.15)',borderRadius:16,padding:'20px 22px',boxShadow:'0 4px 20px rgba(0,0,0,0.4)',transition:'border-color 0.2s'};
  const inputS = {width:'100%',background:'rgba(0,0,0,0.35)',border:'1.5px solid rgba(224,64,251,0.2)',borderRadius:9,padding:'10px 14px',fontSize:14,color:'#f0e8ff',boxSizing:'border-box',transition:'border-color 0.15s'};
  const labelS = {fontSize:12,color:'#8060a0',fontWeight:700,textTransform:'uppercase',letterSpacing:0.6,marginBottom:5,display:'block'};
  const btnPrimary = {background:'linear-gradient(135deg,#7c3aed,#9f67fa)',color:'#fff',border:'none',borderRadius:10,padding:'11px 22px',fontWeight:700,fontSize:14,cursor:'pointer',boxShadow:'0 4px 16px rgba(124,58,237,0.35)',transition:'all 0.15s'};

  return (
    <>
    <Head>
      <title>Garage — Piers 76</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <div style={{background:'#080614',minHeight:'100vh',fontFamily:"'Inter','Segoe UI',system-ui,sans-serif",color:'#f0e8ff'}}>

      {toast && <div style={{position:'fixed',top:20,right:20,zIndex:9999,padding:'13px 22px',borderRadius:12,color:'#fff',fontWeight:600,fontSize:15,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',background:toast.ok?'linear-gradient(135deg,#15803d,#16a34a)':'linear-gradient(135deg,#b91c1c,#dc2626)'}}>{toast.msg}</div>}

      {/* Navbar */}
      <nav className="ci-nav">
        <div className="ci-nav-left">
          <span className="ci-nav-logo">🔧 Piers 76</span>
          <span className="ci-nav-badge">GARAGE</span>
        </div>
        <div className="ci-nav-right">
          <span className="ci-nav-user">{session.user.name}</span>
          <a href='/patron' className="ci-nav-link">📊 Café</a>
          <button onClick={()=>signOut({callbackUrl:'/'})} className="ci-nav-btn">Déconnexion</button>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="ci-tabs">
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} className={`ci-tab-btn${tab===t.key?' active':''}`}
            style={tab===t.key?{borderBottomColor:'#fbbf24',color:'#fbbf24'}:{}}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="ci-page">

        {/* ══ VUE D'ENSEMBLE ══ */}
        {tab==='overview' && (
          <div>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>Vue d'ensemble — semaine en cours</h2>
            {!overview ? <p style={{color:'#5a4080',fontStyle:'italic'}}>Chargement…</p> : (
              <>
                {/* IRS + KPIs */}
                <div style={{display:'flex',gap:24,marginBottom:28,flexWrap:'wrap'}}>
                  {/* IRS box */}
                  <div style={{background:'linear-gradient(135deg,#1a0510 0%,#220818 50%,#160830 100%)',border:'2px solid rgba(220,38,38,0.3)',borderRadius:18,padding:'24px 28px',flex:'0 0 auto',width:'clamp(340px,38%,520px)',display:'flex',gap:24,flexWrap:'wrap',boxShadow:'0 8px 40px rgba(0,0,0,0.6)'}}>
                    <div style={{flex:'1 1 180px',minWidth:160}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#991b1b',textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🏛️ Taxe IRS — Semaine</div>
                      <div style={{fontSize:36,fontWeight:900,color:'#dc2626',lineHeight:1}}>{fmt(overview.weekTaxAmount)}</div>
                      <div style={{fontSize:13,color:'#b91c1c',marginTop:6}}>à verser sur le compte IRS</div>
                      {overview.weekTaxRate===0 && <div style={{marginTop:10,background:'rgba(74,222,128,0.1)',color:'#4ade80',borderRadius:8,padding:'6px 12px',fontSize:13,fontWeight:600}}>✅ Exonéré cette semaine</div>}
                    </div>
                    <div style={{flex:'2 1 260px',display:'flex',flexDirection:'column',gap:6}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#c0a0d8',paddingBottom:6}}><span>CA devis semaine</span><strong>{fmt(overview.weekRevenue)}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#d97706',paddingBottom:6}}><span>− Dépenses</span><strong>− {fmt(overview.weekExpenses)}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#7c3aed',paddingBottom:6}}><span>− Salaires distribués</span><strong>− {fmt(overview.weekSalaries)}</strong></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:15,color:'#f0e8ff',fontWeight:700,borderTop:'2px solid #fca5a5',paddingTop:10,marginTop:4}}><span>= Base imposable</span><strong style={{color:overview.weekNet<0?'#fbbf24':'#dc2626'}}>{fmt(Math.max(0,overview.weekNet))}</strong></div>
                    </div>
                  </div>
                  {/* KPIs */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16,flex:1,minWidth:300,alignContent:'start'}}>
                    {[
                      {icon:'💵',label:'CA semaine',val:fmt(overview.weekRevenue),sub:`${overview.weekCount} devis`},
                      {icon:'📅',label:'CA mois',val:fmt(overview.monthRevenue),sub:`${overview.monthCount} devis`},
                      {icon:'🛒',label:'Dépenses semaine',val:`− ${fmt(overview.weekExpenses)}`,col:'#d97706'},
                      {icon:'👥',label:'Salaires semaine',val:`− ${fmt(overview.weekSalaries)}`,col:'#7c3aed'},
                      {icon:'🏛️',label:`Taxe IRS (${(overview.weekTaxRate*100).toFixed(0)}%)`,val:fmt(overview.weekTaxAmount),col:'#dc2626'},
                      {icon:'📈',label:'Bénéfice net',val:fmt(Math.max(0,overview.weekNet)-overview.weekTaxAmount),col:(overview.weekNet-overview.weekTaxAmount)>=0?'#16a34a':'#dc2626'},
                    ].map((k,i)=>(
                      <div key={i} style={{background:'linear-gradient(145deg,#16102a,#1e1435)',borderRadius:16,padding:'20px',border:'1px solid rgba(224,64,251,0.18)',boxShadow:'0 4px 24px rgba(0,0,0,0.5)'}}>
                        <div style={{fontSize:28,marginBottom:10}}>{k.icon}</div>
                        <div style={{fontSize:12,color:'#6a4890',marginBottom:6,fontWeight:700,textTransform:'uppercase',letterSpacing:0.7}}>{k.label}</div>
                        <div style={{fontSize:28,fontWeight:800,color:k.col||'#f0e8ff',letterSpacing:-0.5}}>{k.val}</div>
                        {k.sub && <div style={{fontSize:12,color:'#5a4080',marginTop:4}}>{k.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Solde bancaire */}
                {(() => {
                  const b = overview.balance;
                  const bal = b.currentBalance;
                  const accent = bal>=0?'#16a34a':'#dc2626';
                  const weeks = b.weeklyHistory||[];
                  const maxAbs = Math.max(1,...weeks.map(w=>Math.abs(w.delta)));
                  const W=400,H=60,pad=4;
                  const bw = weeks.length ? Math.floor((W-pad*2)/weeks.length)-2 : 40;
                  return (
                    <div style={{background:'linear-gradient(135deg,#0a0618,#110820)',border:`2px solid ${bal>=0?'rgba(22,163,74,0.35)':'rgba(220,38,38,0.35)'}`,borderRadius:18,padding:'22px 26px',marginBottom:28,boxShadow:'0 8px 40px rgba(0,0,0,0.55)'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
                        <div style={{flex:'1 1 180px'}}>
                          <div style={{fontSize:11,fontWeight:700,color:accent,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>🏦 Solde Compte Bancaire</div>
                          <div style={{fontSize:40,fontWeight:900,color:accent,lineHeight:1,letterSpacing:-1}}>{fmt(bal)}</div>
                          <div style={{fontSize:12,color:'#6a4890',marginTop:6}}>Réf. {fmt(b.refBalance)} · màj {fmtD(b.refDate)}</div>
                          {!editingBalance ? (
                            <button onClick={()=>{setEditingBalance(true);setNewBalanceVal(bal.toFixed(2));}} style={{marginTop:12,padding:'6px 14px',background:'rgba(224,64,251,0.12)',color:'#c084fc',border:'1px solid rgba(224,64,251,0.3)',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>✏️ Recalibrer</button>
                          ) : (
                            <form onSubmit={handleUpdateBalance} style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
                              <input type="number" step="0.01" value={newBalanceVal} onChange={e=>setNewBalanceVal(e.target.value)} style={{...inputS,width:130,padding:'6px 10px',fontSize:13}} placeholder="Solde réel" autoFocus />
                              <button type="submit" style={{padding:'6px 14px',background:accent,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>✓</button>
                              <button type="button" onClick={()=>setEditingBalance(false)} style={{padding:'6px 10px',background:'rgba(255,255,255,0.06)',color:'#8060a0',border:'none',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
                            </form>
                          )}
                        </div>
                        <div style={{flex:'1 1 200px',display:'flex',flexDirection:'column',gap:8,borderLeft:'1px solid rgba(255,255,255,0.06)',paddingLeft:22}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#a080c8'}}><span>Référence</span><strong style={{color:'#f0e8ff'}}>{fmt(b.refBalance)}</strong></div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#4ade80'}}><span>+ Devis encaissés</span><strong>+ {fmt(b.revSince)}</strong></div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#f87171'}}><span>− Dépenses</span><strong>− {fmt(b.expSince)}</strong></div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#7c3aed'}}><span>− Salaires</span><strong>− {fmt(b.salSince)}</strong></div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:8,marginTop:4}}><span style={{color:'#c0a0d8'}}>= Solde actuel</span><strong style={{color:accent}}>{fmt(bal)}</strong></div>
                        </div>
                        <div style={{flex:'1 1 180px'}}>
                          <div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',letterSpacing:0.6,marginBottom:8}}>Flux net · 8 sem.</div>
                          <svg viewBox={`0 0 ${W} ${H+18}`} style={{width:'100%',maxWidth:W,height:'auto',overflow:'visible'}}>
                            {weeks.map((w,i)=>{
                              const barH=Math.max(3,Math.round((Math.abs(w.delta)/maxAbs)*(H-pad*2)));
                              const x=pad+i*(bw+2);
                              const col=w.delta>=0?'#16a34a':'#dc2626';
                              const barY=w.delta>=0?H-pad-barH:H-pad;
                              const d=new Date(w.week_start);
                              return (<g key={i}><rect x={x} y={barY} width={bw} height={barH} rx={2} fill={col} opacity={0.8}/><text x={x+bw/2} y={H+14} textAnchor="middle" fontSize="8" fill="#5a4080">{d.getDate()}/{d.getMonth()+1}</text></g>);
                            })}
                            <line x1={pad} y1={H-pad} x2={W-pad} y2={H-pad} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ══ DEVIS PERF ══ */}
        {tab==='devis-perf' && (
          <div>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>🔧 Devis Performance</h2>
            <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{flex:3,minWidth:340}}>
                {/* Client */}
                <div style={{...card,border:'1px solid rgba(251,191,36,0.2)',marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:800,color:'#fbbf24',textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>👤 Client & Véhicule</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
                    {[['Prénom','firstName','Michel'],['Nom','lastName','Dupont']].map(([lbl,key,ph])=>(
                      <div key={key}>
                        <label style={labelS}>{lbl}</label>
                        <input value={client[key]} onChange={e=>setClient(c=>({...c,[key]:e.target.value}))} style={inputS} placeholder={ph}/>
                      </div>
                    ))}
                    {/* Recherche véhicule */}
                    <div style={{position:'relative',gridColumn:'span 2'}}>
                      <label style={labelS}>🚗 Véhicule (nom ou spawn ID)</label>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <input
                          value={vehicleSearch}
                          onChange={e=>{setVehicleSearch(e.target.value);setShowVehicleSuggestions(true);if(!e.target.value){setSelectedVehicle(null);setClient(c=>({...c,model:'',category:'Sport'}));}}}
                          onFocus={()=>setShowVehicleSuggestions(true)}
                          onBlur={()=>setTimeout(()=>setShowVehicleSuggestions(false),180)}
                          style={{...inputS,flex:1}}
                          placeholder="Ex: Sultan RS, adder, brioso…"
                        />
                        {selectedVehicle && (
                          <span style={{background:'rgba(74,222,128,0.12)',color:'#4ade80',border:'1px solid rgba(74,222,128,0.3)',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>✓ {selectedVehicle}</span>
                        )}
                      </div>
                      {showVehicleSuggestions && vehicleSuggestions.length>0 && (
                        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#1a0f30',border:'1px solid rgba(224,64,251,0.35)',borderRadius:10,zIndex:200,maxHeight:240,overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.7)',marginTop:4}}>
                          {vehicleSuggestions.map(sv=>(
                            <button key={sv.id} onMouseDown={()=>{
                              setSelectedVehicle(sv.id);
                              setVehicleSearch(sv.name);
                              setShowVehicleSuggestions(false);
                              setClient(c=>({...c, model:sv.name, category:sv.cat}));
                              setSelPerfs(new Set());
                            }} style={{width:'100%',background:'none',border:'none',padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                              <span style={{fontWeight:600,color:'#f0e8ff',fontSize:14}}>{sv.name}</span>
                              <span style={{fontSize:11,color:'#8060a0',background:'rgba(255,255,255,0.06)',borderRadius:6,padding:'2px 8px'}}>{sv.cat} · {sv.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!vehicleData && <div style={{fontSize:11,color:'#5a4080',marginTop:4}}>Chargement des véhicules…</div>}
                    </div>
                    <div>
                      <label style={labelS}>Catégorie (auto)</label>
                      <select value={client.category} onChange={e=>setClient(c=>({...c,category:e.target.value}))} style={{...inputS,opacity:selectedVehicle?0.5:1}}>
                        {CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Section tabs */}
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  <div style={{padding:'10px 18px',borderRadius:10,border:'2px solid #e040fb',background:'rgba(224,64,251,0.12)',color:'#f0e8ff',fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                    🔧 Performances{selPerfs.size>0&&<span style={{background:'#e040fb',color:'#fff',borderRadius:'50%',width:20,height:20,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{selPerfs.size}</span>}
                  </div>
                </div>
                {/* Performances */}
                {activeSection==='perfs' && (
                  <div style={card}>
                    {selectedVehicle && vehicleData?.[selectedVehicle] ? (
                      <div style={{fontSize:12,color:'#4ade80',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                        <span style={{background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.3)',borderRadius:6,padding:'3px 10px',fontWeight:700}}>✓ {vehicleData[selectedVehicle].n}</span>
                        <span style={{color:'#5a4080'}}>Prix spécifiques à ce véhicule</span>
                      </div>
                    ) : (
                      <div style={{fontSize:12,color:'#8060a0',marginBottom:16}}>Prix basés sur la catégorie : <strong style={{color:'#fbbf24'}}>{client.category}</strong>{!selectedVehicle&&<span style={{color:'#6040a0'}}> — sélectionne un véhicule pour des prix exacts</span>}</div>
                    )}
                    {Object.entries(PERF_GROUPS).map(([grp,items])=>(
                      <div key={grp} style={{marginBottom:20}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#c084fc',marginBottom:10}}>{grp}</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                          {items.map(item=>{
                            const vp = getVehiclePrice(item);
                            const price = vp != null ? vp : (PERF_PRICES[item]?.[catIdx]||0);
                            const isVehicleSpecific = vp != null;
                            if (selectedVehicle && vehicleData?.[selectedVehicle]) {
                              const m = VEHICLE_PERF_MAP[item];
                              if (m) {
                                const u = vehicleData[selectedVehicle].u;
                                if (m.k === 'T' && u.T == null) return null;
                                if (m.k !== 'T' && m.i != null) {
                                  const arr = u[m.k];
                                  if (!arr || arr[m.i] == null) return null;
                                }
                              }
                            }
                            const sel=selPerfs.has(item);
                            return (<button key={item} onClick={()=>togglePerf(item)} style={{background:sel?'linear-gradient(145deg,#1e0a30,#280d40)':'#120c22',border:sel?'2px solid #e040fb':'1px solid rgba(224,64,251,0.15)',borderRadius:10,padding:'12px 16px',cursor:'pointer',textAlign:'left',position:'relative'}}>
                              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:14,color:sel?'#f0e8ff':'#c0a0d8'}}>{item}</span>{sel&&<span style={{color:'#e040fb'}}>✓</span>}</div>
                              <div style={{fontSize:15,fontWeight:700,color:sel?'#e040fb':isVehicleSpecific?'#a78bfa':'#8060a0',marginTop:4}}>{fmt(price)}</div>
                              {isVehicleSpecific && !sel && <div style={{position:'absolute',top:6,right:8,fontSize:9,color:'#7c3aed',fontWeight:700,letterSpacing:0.5}}>VÉHICULE</div>}
                            </button>);
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Customs */}
                {activeSection==='customs' && (
                  <div style={card}>
                    <div style={{fontSize:12,color:'#8060a0',marginBottom:16}}>Prix fixe — toutes catégories</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:10}}>
                      {Object.entries(CUSTOM_PRICES).map(([item,price])=>{
                        const sel=selCustoms.has(item);
                        return (<button key={item} onClick={()=>toggleCustom(item)} style={{background:sel?'linear-gradient(145deg,#1e0a30,#280d40)':'#120c22',border:sel?'2px solid #e040fb':'1px solid rgba(224,64,251,0.15)',borderRadius:10,padding:'12px 14px',cursor:'pointer',textAlign:'left'}}>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:13,color:sel?'#f0e8ff':'#c0a0d8'}}>{item}</span>{sel&&<span style={{color:'#e040fb'}}>✓</span>}</div>
                          <div style={{fontSize:14,fontWeight:700,color:sel?'#e040fb':'#8060a0',marginTop:3}}>{fmt(price)}</div>
                        </button>);
                      })}
                    </div>
                  </div>
                )}
                {/* Peintures */}
                {activeSection==='paints' && (
                  <div style={card}>
                    {Object.entries(PAINT_GROUPS).map(([grp,items])=>(
                      <div key={grp} style={{marginBottom:22}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#c084fc',marginBottom:10}}>{grp}</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                          {Object.entries(items).map(([item,price])=>{
                            const sel=selPaints.has(item);
                            return (<button key={item} onClick={()=>togglePaint(item)} style={{background:sel?'linear-gradient(145deg,#1e0a30,#280d40)':'#120c22',border:sel?'2px solid #e040fb':'1px solid rgba(224,64,251,0.15)',borderRadius:10,padding:'12px 14px',cursor:'pointer',textAlign:'left'}}>
                              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:13,color:sel?'#f0e8ff':'#c0a0d8'}}>{item}</span>{sel&&<span style={{color:'#e040fb'}}>✓</span>}</div>
                              <div style={{fontSize:14,fontWeight:700,color:sel?'#e040fb':'#8060a0',marginTop:3}}>{fmt(price)}</div>
                            </button>);
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginTop:16}}>
                  <label style={labelS}>Notes (optionnel)</label>
                  <textarea value={devisNotes} onChange={e=>setDevisNotes(e.target.value)} rows={3} style={{...inputS,resize:'vertical'}} placeholder="Remarques, délai, demandes…"/>
                </div>
              </div>

              {/* Récap sticky */}
              <div style={{flex:'0 0 320px',minWidth:280,position:'sticky',top:80}}>
                <div style={{background:'linear-gradient(145deg,#100820,#180c30)',border:'2px solid rgba(251,191,36,0.3)',borderRadius:18,padding:'24px',boxShadow:'0 8px 40px rgba(0,0,0,0.6)'}}>
                  <div style={{fontSize:13,fontWeight:800,color:'#fbbf24',textTransform:'uppercase',letterSpacing:1,marginBottom:20}}>📄 Récapitulatif</div>
                  {(client.firstName||client.lastName) && (
                    <div style={{marginBottom:16,padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderRadius:10}}>
                      <div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Client</div>
                      <div style={{fontWeight:700,fontSize:15,color:'#f0e8ff'}}>{client.firstName} {client.lastName}</div>
                      {client.model&&<div style={{fontSize:13,color:'#8060a0',marginTop:2}}>{client.model} · {client.category}</div>}
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#c0a0d8'}}>
                      <span>🔧 Performances <span style={{color:'#6a4890'}}>({selPerfs.size})</span></span>
                      <strong style={{color:perfsTotal>0?'#f0e8ff':'#3a2060'}}>{fmt(perfsTotal)}</strong>
                    </div>
                  </div>
                  <div style={{borderTop:'2px solid rgba(251,191,36,0.2)',paddingTop:16,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:15,color:'#d0b8f8',fontWeight:600}}>TOTAL</span>
                    <span style={{fontSize:30,fontWeight:900,color:'#fbbf24',letterSpacing:-1}}>{fmt(perfsTotal)}</span>
                  </div>
                  {[...selPerfs].length>0&&(<div style={{marginBottom:10}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Performances</div>{[...selPerfs].map(p=><div key={p} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#a080c8',padding:'2px 0'}}><span>{p}</span><span>{fmt(perfPrice(p))}</span></div>)}</div>)}


                  <button onClick={submitDevis} disabled={loading||perfsTotal===0} style={{width:'100%',padding:'14px',background:perfsTotal===0?'#1a0c2e':'linear-gradient(135deg,#d97706,#fbbf24)',color:perfsTotal===0?'#3a2060':'#1a0c00',border:'none',borderRadius:12,cursor:perfsTotal===0?'not-allowed':'pointer',fontSize:15,fontWeight:900,marginBottom:10,boxShadow:perfsTotal>0?'0 4px 20px rgba(251,191,36,0.35)':'none'}}>
                    {loading?'Enregistrement…':'✅ Valider le devis Perf'}
                  </button>
                  <button onClick={resetDevis} style={{width:'100%',padding:'10px',background:'none',color:'#5a4080',border:'1px solid rgba(224,64,251,0.18)',borderRadius:10,cursor:'pointer',fontSize:13}}>🗑️ Réinitialiser</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ DEVIS CUSTOM / PEINTURE ══ */}
        {tab==='devis-custom' && (
          <div>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>🎨 Devis Custom & Peinture</h2>
            <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{flex:3,minWidth:340}}>
                {/* Client */}
                <div style={{...card,border:'1px solid rgba(251,191,36,0.2)',marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:800,color:'#fbbf24',textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>👤 Client & Véhicule</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
                    {[['Prénom','firstName','Michel'],['Nom','lastName','Dupont'],['Modèle','model','Sultan RS']].map(([lbl,key,ph])=>(
                      <div key={key}>
                        <label style={labelS}>{lbl}</label>
                        <input value={clientCustom[key]} onChange={e=>setClientCustom(c=>({...c,[key]:e.target.value}))} style={inputS} placeholder={ph}/>
                      </div>
                    ))}
                    <div>
                      <label style={labelS}>Catégorie</label>
                      <select value={clientCustom.category} onChange={e=>setClientCustom(c=>({...c,category:e.target.value}))} style={inputS}>
                        {CATEGORIES.map(cat=><option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Sous-onglets customs/peintures */}
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  {[['customs','🎨 Customs',selCustoms.size],['paints','💅 Peintures',selPaints.size]].map(([key,label,count])=>(
                    <button key={key} onClick={()=>setActiveCustomSection(key)} style={{padding:'10px 18px',borderRadius:10,border:activeCustomSection===key?'2px solid #e040fb':'1px solid rgba(224,64,251,0.2)',background:activeCustomSection===key?'rgba(224,64,251,0.12)':'rgba(255,255,255,0.03)',color:activeCustomSection===key?'#f0e8ff':'#5a4080',fontWeight:600,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                      {label}{count>0&&<span style={{background:'#e040fb',color:'#fff',borderRadius:'50%',width:20,height:20,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{count}</span>}
                    </button>
                  ))}
                </div>
                {/* Customs */}
                {activeCustomSection==='customs' && (
                  <div style={card}>
                    <div style={{fontSize:12,color:'#8060a0',marginBottom:16}}>Prix fixe — toutes catégories</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:10}}>
                      {Object.entries(CUSTOM_PRICES).map(([item,price])=>{
                        const sel=selCustoms.has(item);
                        return (<button key={item} onClick={()=>toggleCustom(item)} style={{background:sel?'linear-gradient(145deg,#1e0a30,#280d40)':'#120c22',border:sel?'2px solid #e040fb':'1px solid rgba(224,64,251,0.15)',borderRadius:10,padding:'12px 14px',cursor:'pointer',textAlign:'left'}}>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:13,color:sel?'#f0e8ff':'#c0a0d8'}}>{item}</span>{sel&&<span style={{color:'#e040fb'}}>✓</span>}</div>
                          <div style={{fontSize:14,fontWeight:700,color:sel?'#e040fb':'#8060a0',marginTop:3}}>{fmt(price)}</div>
                        </button>);
                      })}
                    </div>
                  </div>
                )}
                {/* Peintures */}
                {activeCustomSection==='paints' && (
                  <div style={card}>
                    {Object.entries(PAINT_GROUPS).map(([grp,items])=>(
                      <div key={grp} style={{marginBottom:22}}>
                        <div style={{fontSize:13,fontWeight:700,color:'#c084fc',marginBottom:10}}>{grp}</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                          {Object.entries(items).map(([item,price])=>{
                            const sel=selPaints.has(item);
                            return (<button key={item} onClick={()=>togglePaint(item)} style={{background:sel?'linear-gradient(145deg,#1e0a30,#280d40)':'#120c22',border:sel?'2px solid #e040fb':'1px solid rgba(224,64,251,0.15)',borderRadius:10,padding:'12px 14px',cursor:'pointer',textAlign:'left'}}>
                              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:600,fontSize:13,color:sel?'#f0e8ff':'#c0a0d8'}}>{item}</span>{sel&&<span style={{color:'#e040fb'}}>✓</span>}</div>
                              <div style={{fontSize:14,fontWeight:700,color:sel?'#e040fb':'#8060a0',marginTop:3}}>{fmt(price)}</div>
                            </button>);
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginTop:16}}>
                  <label style={labelS}>Notes (optionnel)</label>
                  <textarea value={customNotes} onChange={e=>setCustomNotes(e.target.value)} rows={3} style={{...inputS,resize:'vertical'}} placeholder="Remarques, délai, demandes…"/>
                </div>
              </div>

              {/* Récap sticky custom */}
              <div style={{flex:'0 0 320px',minWidth:280,position:'sticky',top:80}}>
                <div style={{background:'linear-gradient(145deg,#100820,#180c30)',border:'2px solid rgba(251,191,36,0.3)',borderRadius:18,padding:'24px',boxShadow:'0 8px 40px rgba(0,0,0,0.6)'}}>
                  <div style={{fontSize:13,fontWeight:800,color:'#fbbf24',textTransform:'uppercase',letterSpacing:1,marginBottom:20}}>📄 Récapitulatif</div>
                  {(clientCustom.firstName||clientCustom.lastName) && (
                    <div style={{marginBottom:16,padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderRadius:10}}>
                      <div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Client</div>
                      <div style={{fontWeight:700,fontSize:15,color:'#f0e8ff'}}>{clientCustom.firstName} {clientCustom.lastName}</div>
                      {clientCustom.model&&<div style={{fontSize:13,color:'#8060a0',marginTop:2}}>{clientCustom.model} · {clientCustom.category}</div>}
                    </div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                    {[['🎨 Customs',selCustoms.size,customsTotal],['💅 Peintures',selPaints.size,paintsTotal]].map(([lbl,cnt,tot])=>(
                      <div key={lbl} style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#c0a0d8'}}>
                        <span>{lbl} <span style={{color:'#6a4890'}}>({cnt})</span></span>
                        <strong style={{color:tot>0?'#f0e8ff':'#3a2060'}}>{fmt(tot)}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{borderTop:'2px solid rgba(251,191,36,0.2)',paddingTop:16,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:15,color:'#d0b8f8',fontWeight:600}}>TOTAL</span>
                    <span style={{fontSize:30,fontWeight:900,color:'#fbbf24',letterSpacing:-1}}>{fmt(customsTotal+paintsTotal)}</span>
                  </div>
                  {[...selCustoms].length>0&&(<div style={{marginBottom:10}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Customs</div>{[...selCustoms].map(c=><div key={c} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#a080c8',padding:'2px 0'}}><span>{c}</span><span>{fmt(CUSTOM_PRICES[c]||0)}</span></div>)}</div>)}
                  {[...selPaints].length>0&&(<div style={{marginBottom:10}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Peintures</div>{[...selPaints].map(p=>{let pr=0;for(const g of Object.values(PAINT_GROUPS)){if(g[p]){pr=g[p];break;}}return<div key={p} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#a080c8',padding:'2px 0'}}><span>{p}</span><span>{fmt(pr)}</span></div>;})}</div>)}
                  <button onClick={submitCustomDevis} disabled={loading||(customsTotal+paintsTotal===0)} style={{width:'100%',padding:'14px',background:(customsTotal+paintsTotal)===0?'#1a0c2e':'linear-gradient(135deg,#d97706,#fbbf24)',color:(customsTotal+paintsTotal)===0?'#3a2060':'#1a0c00',border:'none',borderRadius:12,cursor:(customsTotal+paintsTotal)===0?'not-allowed':'pointer',fontSize:15,fontWeight:900,marginBottom:10,boxShadow:(customsTotal+paintsTotal)>0?'0 4px 20px rgba(251,191,36,0.35)':'none'}}>
                    {loading?'Enregistrement…':'✅ Valider le devis Custom'}
                  </button>
                  <button onClick={resetCustomDevis} style={{width:'100%',padding:'10px',background:'none',color:'#5a4080',border:'1px solid rgba(224,64,251,0.18)',borderRadius:10,cursor:'pointer',fontSize:13}}>🗑️ Réinitialiser</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ REGISTRE ══ */}
        {tab==='registre' && (() => {
          const now = new Date();
          const weekStart = new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const filteredQ = quotes.filter(q => {
            const d = new Date(q.created_at);
            if (registreFilter==='week')  return d >= weekStart;
            if (registreFilter==='month') return d >= monthStart;
            return true;
          });
          return (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:22}}>
              <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',margin:0}}>Registre des clients</h2>
              <div style={{display:'flex',gap:8}}>
                {[['all','Tout'],['week','Cette semaine'],['month','Ce mois']].map(([v,l])=>(
                  <button key={v} onClick={()=>setRegistreFilter(v)}
                    style={{padding:'6px 14px',borderRadius:20,border:registreFilter===v?'2px solid #fbbf24':'1px solid rgba(251,191,36,0.2)',background:registreFilter===v?'rgba(251,191,36,0.12)':'rgba(255,255,255,0.03)',color:registreFilter===v?'#fbbf24':'#6a4890',fontSize:13,fontWeight:registreFilter===v?700:500,cursor:'pointer'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {filteredQ.length===0 ? (
              <div style={{color:'#5a4080',textAlign:'center',padding:48,background:'#120c22',borderRadius:16,border:'1px dashed rgba(224,64,251,0.18)'}}>Aucun devis pour cette période.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {filteredQ.map((q,i)=>(
                  <div key={q.id} style={{background:'linear-gradient(145deg,#16102a,#1e1435)',border:'1px solid rgba(224,64,251,0.18)',borderRadius:14,overflow:'hidden'}}>
                    <button onClick={()=>setExpandedQuote(expandedQuote===q.id?null:q.id)} style={{width:'100%',background:'none',border:'none',padding:'16px 22px',cursor:'pointer',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                      <span style={{background:'rgba(251,191,36,0.12)',color:'#fbbf24',borderRadius:8,padding:'4px 10px',fontSize:13,fontWeight:700}}>#{i+1}</span>
                      <span style={{fontWeight:700,fontSize:15,color:'#f0e8ff',flex:1,textAlign:'left'}}>{q.client_first_name} {q.client_last_name}</span>
                      <span style={{fontSize:13,color:'#8060a0'}}>{q.vehicle_model} · <strong style={{color:'#c084fc'}}>{q.vehicle_category}</strong></span>
                      <span style={{fontSize:20,fontWeight:800,color:'#fbbf24'}}>{fmt(q.grand_total)}</span>
                      <span style={{fontSize:12,color:'#5a4080'}}>{fmtD(q.created_at)}</span>
                      <span style={{color:'#5a4080',fontSize:14}}>{expandedQuote===q.id?'▲':'▼'}</span>
                    </button>
                    {expandedQuote===q.id && (
                      <div style={{padding:'0 22px 20px',borderTop:'1px solid rgba(224,64,251,0.1)'}}>
                        <div style={{display:'flex',gap:20,flexWrap:'wrap',marginTop:16}}>
                          {q.selected_performances?.length>0&&(<div style={{flex:1,minWidth:180}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>🔧 Perfs — {fmt(q.perfs_total)}</div>{q.selected_performances.map(p=><div key={p.type} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#a080c8',padding:'2px 0'}}><span>{p.type}</span><span>{fmt(p.price)}</span></div>)}</div>)}
                          {q.selected_customs?.length>0&&(<div style={{flex:1,minWidth:180}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>🎨 Customs — {fmt(q.customs_total)}</div>{q.selected_customs.map(c=><div key={c.type} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#a080c8',padding:'2px 0'}}><span>{c.type}</span><span>{fmt(c.price)}</span></div>)}</div>)}
                          {q.selected_paints?.length>0&&(<div style={{flex:1,minWidth:180}}><div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>💅 Peintures — {fmt(q.paints_total)}</div>{q.selected_paints.map(p=><div key={p.type} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#a080c8',padding:'2px 0'}}><span>{p.type}</span><span>{fmt(p.price)}</span></div>)}</div>)}
                        </div>
                        {q.notes&&<div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,0.04)',borderRadius:8,fontSize:13,color:'#8060a0'}}>📝 {q.notes}</div>}
                        <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(224,64,251,0.1)',display:'flex',justifyContent:'space-between'}}>
                          <span style={{fontSize:12,color:'#5a4080'}}>Par : {q.employee_name||'—'}</span>
                          <span style={{fontSize:18,fontWeight:800,color:'#fbbf24'}}>Total : {fmt(q.grand_total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })()}

        {/* ══ DÉPENSES ══ */}
        {tab==='depenses' && (
          <div>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>Dépenses & Achats</h2>
            {/* Formulaire */}
            <div style={{...card,marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:700,color:'#c084fc',marginBottom:16}}>➕ Nouvelle dépense</div>
              <form onSubmit={submitExpense}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14,marginBottom:14}}>
                  <div>
                    <label style={labelS}>Description</label>
                    <input value={newExp.description} onChange={e=>setNewExp(n=>({...n,description:e.target.value}))} style={inputS} placeholder="Ex: Pièces moteur Sultan"/>
                  </div>
                  <div>
                    <label style={labelS}>Montant ($)</label>
                    <input type="number" step="0.01" min="0" value={newExp.amount} onChange={e=>setNewExp(n=>({...n,amount:e.target.value}))} style={inputS} placeholder="0.00"/>
                  </div>
                  <div>
                    <label style={labelS}>Catégorie</label>
                    <select value={newExp.category} onChange={e=>setNewExp(n=>({...n,category:e.target.value}))} style={inputS}>
                      {EXPENSE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelS}>Date</label>
                    <input type="date" value={newExp.expense_date} onChange={e=>setNewExp(n=>({...n,expense_date:e.target.value}))} style={inputS}/>
                  </div>
                </div>
                <button type="submit" style={btnPrimary}>+ Ajouter la dépense</button>
              </form>
            </div>
            {/* Liste */}
            {expenses.length===0 ? (
              <div style={{color:'#5a4080',textAlign:'center',padding:48,background:'#120c22',borderRadius:16,border:'1px dashed rgba(224,64,251,0.18)'}}>Aucune dépense enregistrée.</div>
            ) : (
              <div style={{overflowX:'auto',borderRadius:14}}>
                <table style={{width:'100%',borderCollapse:'collapse',background:'#120c22',borderRadius:14,overflow:'hidden'}}>
                  <thead>
                    <tr>
                      {['Date','Description','Catégorie','Montant','Par',''].map(h=>(
                        <th key={h} style={{background:'#0a061a',padding:'13px 16px',textAlign:'left',fontSize:12,fontWeight:700,color:'#8060a0',textTransform:'uppercase',letterSpacing:0.8,borderBottom:'1px solid rgba(224,64,251,0.18)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(ex=>(
                      <tr key={ex.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                        <td style={{padding:'13px 16px',fontSize:14,color:'#5a4080'}}>{fmtD(ex.expense_date)}</td>
                        <td style={{padding:'13px 16px',fontSize:14,color:'#f0e8ff',fontWeight:600}}>{ex.description}</td>
                        <td style={{padding:'13px 16px'}}><span style={{background:'rgba(224,64,251,0.12)',color:'#c084fc',padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{ex.category}</span></td>
                        <td style={{padding:'13px 16px',fontSize:15,fontWeight:700,color:'#f87171'}}>− {fmt(ex.amount)}</td>
                        <td style={{padding:'13px 16px',fontSize:13,color:'#5a4080'}}>{ex.employee_name||'—'}</td>
                        <td style={{padding:'13px 16px'}}>
                          <button onClick={()=>deleteExpense(ex.id)} style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.25)',color:'#f87171',borderRadius:7,padding:'5px 12px',cursor:'pointer',fontSize:12}}>Supprimer</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ EMPLOYÉS ══ */}
        {tab==='employes' && (
          <div>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>Employés & Salaires</h2>
            {/* Bannière salaire */}
            {salaryInfo && (
              <div style={{background:'linear-gradient(145deg,#1a1408,#221c08)',border:'2px solid rgba(251,191,36,0.3)',borderRadius:16,padding:'20px 24px',marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#92400e',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>💰 Salaires à distribuer</div>
                    <div style={{fontSize:32,fontWeight:900,color:'#fbbf24'}}>{fmt(salaryInfo.totalToPay)}</div>
                    <div style={{fontSize:12,color:'#78350f',marginTop:4}}>
                      Depuis : {lastPaid && new Date(lastPaid).getFullYear()>1970 ? fmtD(lastPaid) : 'le début'}
                    </div>
                  </div>
                  {salaryInfo.totalToPay>0 ? (
                    <button onClick={handlePaySalaries} disabled={payingNow} style={{padding:'12px 28px',background:payingNow?'#5a4080':'linear-gradient(135deg,#d97706,#fbbf24)',color:'#1a0c00',border:'none',borderRadius:10,cursor:payingNow?'not-allowed':'pointer',fontSize:14,fontWeight:900,boxShadow:'0 4px 20px rgba(251,191,36,0.35)'}}>
                      {payingNow?'…':'💸 Payer ' + fmt(salaryInfo.totalToPay)}
                    </button>
                  ) : (
                    <div style={{background:'rgba(74,222,128,0.1)',color:'#4ade80',borderRadius:10,padding:'10px 20px',fontWeight:700,fontSize:14}}>✅ Salaires à jour</div>
                  )}
                </div>
                {salaryInfo.history?.length>0 && (
                  <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid rgba(251,191,36,0.15)'}}>
                    <div style={{fontSize:11,color:'#78350f',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Historique des paiements</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {salaryInfo.history.map(h=>(
                        <div key={h.id} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#a08020'}}>
                          <span>{fmtD(h.paid_at)}</span><span style={{fontWeight:700,color:'#fbbf24'}}>{fmt(h.total_amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Cartes employés */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
              {employees.map(emp=>(
                <div key={emp.id} style={{...card}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:16,color:'#f0e8ff'}}>{emp.name}</div>
                      <span style={{background:'rgba(224,64,251,0.12)',color:'#e040fb',padding:'2px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{emp.role==='patron'?'Patron':'Employé'}</span>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:11,color:'#6a4890',fontWeight:700,textTransform:'uppercase'}}>Commission</div>
                      <div style={{fontSize:22,fontWeight:800,color:'#c084fc'}}>{emp.salary_percent||0}%</div>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#a080c8'}}>
                      <span>CA période <span style={{fontSize:11,color:'#5a4080'}}>({emp.period_count} devis)</span></span>
                      <strong style={{color:'#f0e8ff'}}>{fmt(emp.period_revenue)}</strong>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:14,color:'#a080c8'}}>
                      <span>💰 Salaire période</span>
                      <strong style={{color:'#4ade80',fontSize:16}}>{fmt(emp.period_salary)}</strong>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#6a4890'}}>
                      <span>CA mois</span><span>{fmt(emp.month_revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ MON COMPTE ══ */}
        {tab==='compte' && (
          <div style={{maxWidth:480}}>
            <h2 style={{fontSize:24,fontWeight:700,color:'#f0e8ff',marginBottom:22}}>Mon Compte</h2>
            <div style={{...card}}>
              <div style={{fontSize:11,color:'#8060a0',marginBottom:4,textTransform:'uppercase',letterSpacing:0.6,fontWeight:700}}>Nom</div>
              <div style={{fontSize:18,fontWeight:700,color:'#f0e8ff',marginBottom:18}}>{session.user.name}</div>
              <div style={{fontSize:11,color:'#8060a0',marginBottom:4,textTransform:'uppercase',letterSpacing:0.6,fontWeight:700}}>Identifiant</div>
              <div style={{fontSize:16,fontWeight:600,color:'#e040fb',marginBottom:18}}>@{session.user.username}</div>
              <div style={{fontSize:11,color:'#8060a0',marginBottom:4,textTransform:'uppercase',letterSpacing:0.6,fontWeight:700}}>Entreprise</div>
                   <div style={{fontSize:15,fontWeight:600,color:'#d0b8f8'}}>{session.user.companyName}</div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
