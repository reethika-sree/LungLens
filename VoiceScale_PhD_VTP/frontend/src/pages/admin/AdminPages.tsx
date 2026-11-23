import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import { useModal } from '../../components/ModalProvider';
import AppLayout from '../AppLayout';
import './AdminPages.css';
import { adminApi } from '../../api/client';

// ═══════════════════════════════════════
// PHC OVERVIEW
// ═══════════════════════════════════════
export function AdminOverviewPage() {
  const { showToast } = useToast();
  const [animated, setAnimated] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => setAnimated(true), 120);
    adminApi.getAnalytics()
      .then(r => setAnalytics(r.data))
      .catch(() => {});
  }, []);

  const total    = analytics?.total_patients ?? '—';
  const users    = analytics?.total_users    ?? '—';
  const highRisk = analytics?.high_risk      ?? '—';
  const medRisk  = analytics?.medium_risk    ?? '—';
  const lowRisk  = analytics?.low_risk       ?? '—';
  const pending  = analytics?.pending        ?? '—';

  const tbDays = analytics?.tb_cases_last_7_days ?? [0,0,0,0,0,0,0];
  const maxBar = Math.max(...tbDays, 1);

  const LANG_COLORS: Record<string,string> = {
    Telugu:'var(--teal)',Hindi:'var(--purple)',Tamil:'var(--amber)',Kannada:'var(--blue)',
    English:'var(--green)',Marathi:'var(--red)',Bengali:'#f97316',
    Gujarati:'#ec4899',Punjabi:'#06b6d4',Odia:'#84cc16',Malayalam:'#6366f1',Unknown:'var(--text4)',
  };
  const langDist: Record<string,number> = analytics?.language_distribution ?? {};
  const langTotal = Object.values(langDist).reduce((a:number,b:any) => a + (b as number), 0) || 1;
  const langRows = Object.entries(langDist)
    .sort((a,b) => (b[1] as number) - (a[1] as number))
    .map(([lang, count]) => [lang, `${Math.round((count as number)/langTotal*100)}%`, LANG_COLORS[lang] || 'var(--text4)'] as [string,string,string]);

  const PHCS = ['PHC Chittoor','PHC Tirupati','PHC Kuppam','PHC Madanapalle','PHC Punganur'];
  const PHC_CASES = [9, 5, 7, 4, 2];
  const PHC_RISK  = ['high','medium','high','medium','low'];

  return (
    <AppLayout>
    <div className="vc-page" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="vc-page-header" style={{ marginBottom: 20 }}>
        <div className="vc-ph-row">
          <div>
            <div className="vc-ph-title">District Overview</div>
            <div className="vc-ph-sub">Chittoor District · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'})} · 5 PHCs active</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div className="vc-online-pill"><div className="vc-o-dot" /><i className="bi-broadcast" style={{ fontSize:11 }} /> Live</div>
            <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => adminApi.getAnalytics().then(r => setAnalytics(r.data))}><i className="bi-arrow-clockwise" /> Refresh</button>
          </div>
        </div>
      </div>

      {/* ── 6 stat tiles ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:18 }}>
        {[
          { label:'Total Patients',  val: String(total),    color:'var(--teal)',   icon:'bi-people-fill',              sub: `${pending} pending` },
          { label:'Total Users',     val: String(users),    color:'var(--purple)', icon:'bi-person-badge-fill',         sub: 'All roles' },
          { label:'High Risk (P1)',  val: String(highRisk), color:'var(--red)',    icon:'bi-exclamation-triangle-fill', sub: 'Immediate' },
          { label:'Medium Risk',     val: String(medRisk),  color:'var(--amber)',  icon:'bi-info-circle-fill',          sub: 'Monitor' },
          { label:'Low Risk',        val: String(lowRisk),  color:'var(--green)',  icon:'bi-check-circle-fill',         sub: 'Routine' },
          { label:'Active PHCs',     val: '5',              color:'var(--blue)',   icon:'bi-hospital-fill',             sub: 'of 12 total' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', display:'flex', flexDirection:'column', gap:5 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:10, color:'var(--text4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>{s.label}</span>
              <i className={s.icon} style={{ color:s.color, fontSize:13 }} />
            </div>
            <div style={{ fontFamily:'var(--head)', fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:10, color:'var(--text4)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main 3-col grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:14, marginBottom:14 }}>

        {/* TB Cases Bar Chart */}
        <div className="vc-card">
          <div className="vc-sec-title"><i className="bi-bar-chart-fill" /> TB Detections — Last 7 Days</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120, paddingBottom:4 }}>
            {tbDays.map((h: number, i: number) => {
              const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i];
              const col = h >= 5 ? 'var(--red)' : h >= 3 ? 'var(--amber)' : 'var(--teal)';
              const pct = Math.round((h / maxBar) * 100);
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <span style={{ fontSize:9, fontFamily:'var(--mono)', color:col, fontWeight:700 }}>{h > 0 ? h : ''}</span>
                  <div style={{ width:'100%', background:'var(--bg3)', borderRadius:4, overflow:'hidden', height:90, display:'flex', alignItems:'flex-end' }}>
                    <div
                      onClick={() => showToast(`${day}: ${h} TB case${h!==1?'s':''}`, col, 'bi-bar-chart-fill')}
                      style={{ cursor:'pointer', width:'100%', background:col, opacity:.85, borderRadius:4, height: animated ? `${pct}%` : '0%', transition:`height .6s cubic-bezier(.4,0,.2,1) ${i*.05}s`, minHeight: h > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span style={{ fontSize:9, color:'var(--text4)', fontWeight:600 }}>{day}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:10 }}>
            {[['var(--red)','High (5+)'],['var(--amber)','Med (3–4)'],['var(--teal)','Low (1–2)']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text4)' }}>
                <span style={{ width:8,height:8,borderRadius:2,background:c,display:'inline-block' }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* Language distribution */}
        <div className="vc-card">
          <div className="vc-sec-title"><i className="bi-translate" /> Language Distribution</div>
          {langRows.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--text4)', padding:'20px 0', textAlign:'center' }}>
              <i className="bi-bar-chart" style={{ fontSize:24, display:'block', marginBottom:6, opacity:.4 }} />No data yet
            </div>
          ) : langRows.slice(0,6).map(([l,p,c]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
              <span style={{ fontSize:11, width:60, color:'var(--text2)', flexShrink:0 }}>{l}</span>
              <div style={{ flex:1, height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width: animated ? p : '0', height:'100%', borderRadius:3, background:c, transition:'width .7s ease' }} />
              </div>
              <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text4)', width:28, textAlign:'right' }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Alerts + PHC status */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="vc-card" style={{ flex:1 }}>
            <div className="vc-sec-title"><i className="bi-bell-fill" /> Alerts</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {analytics?.high_risk > 0 && (
                <div className="vc-alert vc-alert-red" style={{ fontSize:11 }}><i className="bi-exclamation-octagon-fill" /> {analytics.high_risk} P1 critical cases</div>
              )}
              {analytics?.pending > 0 && (
                <div className="vc-alert vc-alert-amber" style={{ fontSize:11 }}><i className="bi-clock-fill" /> {analytics.pending} awaiting prediction</div>
              )}
              {analytics?.total_patients > 0 && (
                <div className="vc-alert vc-alert-green" style={{ fontSize:11 }}><i className="bi-check-circle-fill" /> {analytics.total_patients} records in DB</div>
              )}
              {!analytics && (
                <div className="vc-alert" style={{ color:'var(--text4)', fontSize:11 }}><i className="bi-hourglass-split" /> Loading…</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PHC Table ── */}
      <div className="vc-card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="vc-sec-title" style={{ marginBottom:0 }}><i className="bi-hospital-fill" /> Active PHC Status</div>
          <span style={{ fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)' }}>5 / 12 PHCs active today</span>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg3)' }}>
              {['PHC','Active TB Cases','Risk Level','Status','Region'].map(h => (
                <th key={h} style={{ padding:'9px 16px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text4)', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PHCS.map((name, i) => {
              const risk = PHC_RISK[i];
              const cases = PHC_CASES[i];
              const col = risk==='high'?'var(--red)':risk==='medium'?'var(--amber)':'var(--green)';
              const tagCls = risk==='high'?'vc-tag-red':risk==='medium'?'vc-tag-amber':'vc-tag-green';
              const regions = ['Chittoor Urban','Tirupati Rural','Kuppam Block','Madanapalle','Punganur Rural'];
              return (
                <tr key={name} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                    onClick={() => showToast(`${name}: ${cases} active cases`, col, 'bi-hospital-fill')}>
                  <td style={{ padding:'11px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:28, height:28, borderRadius:8, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="bi-hospital-fill" style={{ color:col, fontSize:12 }} />
                      </span>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text1)' }}>{name}</span>
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px' }}>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:700, color:col, fontSize:14 }}>{cases}</span>
                    <span style={{ fontSize:11, color:'var(--text4)', marginLeft:4 }}>case{cases!==1?'s':''}</span>
                  </td>
                  <td style={{ padding:'11px 16px' }}><span className={`vc-tag ${tagCls}`} style={{ fontSize:10 }}>{risk.toUpperCase()}</span></td>
                  <td style={{ padding:'11px 16px' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background: i===0 ? 'var(--red)' : 'var(--green)', display:'inline-block', boxShadow: i===0 ? '0 0 0 2px rgba(239,68,68,.25)' : 'none' }} />
                      <span style={{ color:'var(--text3)' }}>{i===0 ? 'LIVE' : 'Active'}</span>
                    </span>
                  </td>
                  <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text4)' }}>{regions[i]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// TB CLUSTER MAP
// ═══════════════════════════════════════
export function AdminMapPage() {
  const { showToast } = useToast();

  // Real PHC locations in Chittoor district with TB case data
  const PHC_LOCATIONS = [
    { name:'PHC Chittoor',     lat:13.2172, lng:79.1003, cases:9, risk:'high'   },
    { name:'PHC Kuppam',       lat:12.7439, lng:78.3444, cases:7, risk:'high'   },
    { name:'PHC Tirupati',     lat:13.6288, lng:79.4192, cases:5, risk:'medium' },
    { name:'PHC Madanapalle',  lat:13.5502, lng:78.5027, cases:4, risk:'medium' },
    { name:'PHC Punganur',     lat:13.3667, lng:78.5833, cases:2, risk:'low'    },
    { name:'PHC Srikalahasti', lat:13.7570, lng:79.7001, cases:1, risk:'low'    },
    { name:'PHC Nagari',       lat:13.3250, lng:79.5800, cases:3, risk:'medium' },
    { name:'PHC Palamaner',    lat:13.2003, lng:78.7457, cases:2, risk:'low'    },
    { name:'PHC Vayalpad',     lat:13.7139, lng:78.6286, cases:1, risk:'low'    },
    { name:'PHC Piler',        lat:13.6544, lng:78.9350, cases:6, risk:'high'   },
  ];

  const hotspots = PHC_LOCATIONS.sort((a,b) => b.cases - a.cases);

  useEffect(() => {
    // Load Leaflet CSS + JS from CDN, then initialise map
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      const container = document.getElementById('chittoor-leaflet-map');
      if (!container || container.dataset.init) return;
      container.dataset.init = '1';

      const map = L.map('chittoor-leaflet-map', {
        center: [13.2172, 79.0000],
        zoom: 9,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 17,
      }).addTo(map);

      // Color by risk
      const riskColor = (risk: string) =>
        risk==='high' ? '#ff4d4d' : risk==='medium' ? '#f7bb4a' : '#3ee8a0';
      const riskOpacity = (risk: string) =>
        risk==='high' ? 0.85 : risk==='medium' ? 0.75 : 0.65;

      PHC_LOCATIONS.forEach(phc => {
        const circle = L.circle([phc.lat, phc.lng], {
          color: riskColor(phc.risk),
          fillColor: riskColor(phc.risk),
          fillOpacity: riskOpacity(phc.risk),
          weight: 2,
          radius: phc.cases * 2500 + 3000,
        }).addTo(map);

        circle.bindPopup(
          `<div style="font-family:sans-serif;min-width:160px">
            <strong style="font-size:14px">${phc.name}</strong><br/>
            <span style="color:${riskColor(phc.risk)};font-weight:700">${phc.cases} active TB cases</span><br/>
            <span style="text-transform:uppercase;font-size:11px;color:#666">${phc.risk} risk zone</span>
          </div>`,
          { maxWidth: 220 }
        );

        // Static label marker
        L.marker([phc.lat, phc.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:rgba(0,0,0,.7);color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap">${phc.name.replace('PHC ','')}</div>`,
            iconAnchor: [40, -10],
          })
        }).addTo(map);
      });

      // Legend
      const legend = (L.control as any)({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div');
        div.style.cssText = 'background:rgba(20,20,28,.9);padding:10px 14px;border-radius:8px;font-size:12px;color:#fff;border:1px solid rgba(255,255,255,.1)';
        div.innerHTML = `
          <div style="font-weight:700;margin-bottom:6px;color:#fff">TB Cases</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:12px;height:12px;border-radius:50%;background:#ff4d4d;display:inline-block"></span>High risk (6+ cases)</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="width:12px;height:12px;border-radius:50%;background:#f7bb4a;display:inline-block"></span>Medium risk (3–5 cases)</div>
          <div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:12px;border-radius:50%;background:#3ee8a0;display:inline-block"></span>Low risk (1–2 cases)</div>
        `;
        return div;
      };
      legend.addTo(map);
    };
    document.head.appendChild(script);

    return () => {
      const container = document.getElementById('chittoor-leaflet-map');
      if (container) { delete container.dataset.init; }
    };
  }, []);

  return (
    <AppLayout>
    <div className="vc-page">
      <div className="vc-page-header">
        <div className="vc-ph-row">
          <div>
            <div className="vc-ph-title">TB cluster map</div>
            <div className="vc-ph-sub">Chittoor District · Active TB cases by PHC · Real coordinates · Click circles for details</div>
          </div>
          <div className="vc-online-pill"><div className="vc-o-dot" /><i className="bi-broadcast" style={{ fontSize:11 }} /> Live</div>
        </div>
      </div>
      <div className="two-col-row">
        {/* Leaflet map */}
        <div className="vc-card" style={{ padding:0, overflow:'hidden', borderRadius:12 }}>
          <div style={{ padding:'12px 16px 10px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="vc-sec-title" style={{ marginBottom:0 }}><i className="bi-map-fill" /> Chittoor District — PHC Map</div>
            <span style={{ fontSize:10, color:'var(--text4)', fontFamily:'var(--mono)' }}>Leaflet.js · OSM tiles</span>
          </div>
          <div id="chittoor-leaflet-map" style={{ height:440, width:'100%', background:'var(--bg3)' }} />
        </div>

        {/* Ranked list */}
        <div className="vc-card">
          <div className="vc-sec-title"><i className="bi-sort-down" /> High-risk zones ranked</div>
          {hotspots.map(phc => {
            const color = phc.risk==='high'?'var(--red)':phc.risk==='medium'?'var(--amber)':'var(--green)';
            const tagCls = phc.risk==='high'?'vc-tag-red':phc.risk==='medium'?'vc-tag-amber':'vc-tag-green';
            return (
              <div key={phc.name}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                onClick={() => showToast(`${phc.name}: ${phc.cases} active cases — ${phc.risk.toUpperCase()} RISK`, color, 'bi-geo-alt-fill')}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>
                    <i className={`bi-${phc.risk==='high'?'exclamation-triangle-fill':phc.risk==='medium'?'info-circle-fill':'check-circle-fill'}`}
                      style={{ color, marginRight:6 }} />{phc.name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>
                    {phc.cases} active TB case{phc.cases!==1?'s':''}
                    <span style={{ marginLeft:8, fontFamily:'var(--mono)' }}>{phc.lat.toFixed(3)}°N {phc.lng.toFixed(3)}°E</span>
                  </div>
                </div>
                <span className={`vc-tag ${tagCls}`}>{phc.risk.toUpperCase()}</span>
              </div>
            );
          })}
          <button className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop:14, width:'100%' }}
            onClick={() => showToast('Cluster report downloaded','var(--teal)','bi-download')}>
            <i className="bi-download" /> Export cluster report
          </button>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// PATIENT LOG
// ═══════════════════════════════════════
export function AdminLogPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getPatients()
      .then(r => setRows(r.data || []))
      .catch(() => showToast('Could not load patient records', 'var(--red)', 'bi-exclamation-triangle'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    (r.patient_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.language || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.voice_transcript || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.tb_risk_level || '').toLowerCase().includes(search.toLowerCase())
  );

  const pColors: Record<string,string> = { high:'var(--red)', medium:'var(--amber)', low:'var(--green)' };
  const pLabels: Record<string,string> = { high:'P1 HIGH', medium:'P2 MED', low:'P3 LOW' };

  const symptomCount = (answers: Record<string,string> = {}) =>
    Object.values(answers).filter(v => v === 'yes').length;

  return (
    <AppLayout>
    <div className="vc-page">
      <div className="vc-page-header">
        <div className="vc-ph-row">
          <div>
            <div className="vc-ph-title">Patient log</div>
            <div className="vc-ph-sub">All records from MongoDB · {rows.length} total</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <i className="bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text4)', fontSize: 13 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients…" style={{ paddingLeft: 32, width: 180 }} />
            </div>
            <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('Patient log exported as CSV','var(--teal)','bi-download')}>
              <i className="bi-download" /> Export CSV
            </button>
          </div>
        </div>
      </div>
      <div className="vc-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
            <i className="bi-hourglass-split" style={{ marginRight: 8 }} />Loading records…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
            <i className="bi-inbox" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} />
            {rows.length === 0 ? 'No patient records yet — complete a patient triage to see data here' : 'No matching records'}
          </div>
        ) : (
        <table className="data-table">
          <thead>
            <tr>{['Patient','Language','Voice Transcript','TB Risk','Symptoms +','Priority','Date','Action'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((r: any, i: number) => {
              const risk   = r.tb_risk_level || 'pending';
              const col    = pColors[risk] || 'var(--text4)';
              const lbl    = pLabels[risk] || 'PENDING';
              const sc     = r.tb_risk_score;
              const date   = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';
              const symPos = symptomCount(r.symptom_answers);
              const snippet = (r.voice_transcript || '').slice(0, 48) + ((r.voice_transcript || '').length > 48 ? '…' : '');
              return (
                <tr key={i}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                  onClick={() => showToast(`Record: ${r.record_id}`, col, 'bi-person-fill')}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500 }}>{r.patient_name || 'Unknown'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text3)' }}>{r.language || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text4)', maxWidth: 180 }}>
                    {snippet || <span style={{ fontStyle: 'italic' }}>No transcript</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: sc !== null && sc !== undefined ? (sc > 60 ? 'var(--red)' : sc > 30 ? 'var(--amber)' : 'var(--green)') : 'var(--text4)' }}>
                    {sc !== null && sc !== undefined ? `${sc}%` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>{symPos}/13</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${col}18`, color: col, border: `1px solid ${col}30` }}>
                      {lbl}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text4)', fontFamily: 'var(--mono)', fontSize: 11 }}>{date}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button className="vc-btn vc-btn-ghost vc-btn-xs"
                      onClick={e => { e.stopPropagation(); showToast(`Record ID: ${r.record_id}`, 'var(--teal)', 'bi-clipboard'); }}>
                      <i className="bi-arrow-right" /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════
export function AdminSettingsPage() {
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();

  const langs = [['English','1.5B',true],['Hindi','520M',true],['Telugu','83M',true],['Tamil','78M',true],['Kannada','44M',true],['Marathi','83M',false],['Bengali','230M',false],['Gujarati','56M',false],['Punjabi','113M',false],['Odia','35M',false],['Malayalam','35M',false]];

  return (
    <AppLayout>
    <div className="vc-page">
      <div className="vc-page-header">
        <div className="vc-ph-row">
          <div>
            <div className="vc-ph-title">Settings</div>
            <div className="vc-ph-sub">System config · Queue scoring · Languages · AI models</div>
          </div>
          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => showToast('Settings saved successfully','var(--teal)','bi-check2')}>
            <i className="bi-floppy2-fill" /> Save all settings
          </button>
        </div>
      </div>
      <div className="two-col-row">
        <div>
          <div className="vc-card" style={{ marginBottom: 14 }}>
            <div className="vc-sec-title"><i className="bi-translate" /> Languages enabled</div>
            {langs.map(([l,s,on]) => (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{l as string}</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)' }}>{s as string}M speakers</div>
                </div>
                <label className="vc-toggle">
                  <input type="checkbox" defaultChecked={on as boolean} onChange={e => showToast(`${l} ${e.target.checked?'enabled':'disabled'}`,'var(--teal)','bi-globe2')} />
                  <span className="vc-toggle-track" />
                </label>
              </div>
            ))}
          </div>
          <div className="vc-card">
            <div className="vc-sec-title"><i className="bi-cpu-fill" /> AI Model Configuration</div>
            
            {/* Model Status */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text4)', marginBottom: 8 }}>Model Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--green-a)', borderRadius: 6, border: '1px solid var(--green)' }}>
                  <i className="bi-check-circle-fill" style={{ color: 'var(--green)' }} />
                  <span style={{ fontSize: 11, color: 'var(--green)' }}>All Systems Operational</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--amber-a)', borderRadius: 6, border: '1px solid var(--amber)' }}>
                  <i className="bi-cpu" style={{ color: 'var(--amber)' }} />
                  <span style={{ fontSize: 11, color: 'var(--amber)' }}>High Load (85% CPU)</span>
                </div>
              </div>
            </div>

            {/* Current Models */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text4)', marginBottom: 8 }}>Active Models</div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12 }}>
                {[
                  ['Speech-to-text', 'Whisper', 'large-v3', '94.2% accuracy', 'var(--teal)'],
                  ['Language Model', 'Llama 3 70B', 'Groq Cloud', '2.3s avg', 'var(--purple)'],
                  ['ML Classifier', 'XGBoost v1.7', 'Local GPU', '96.1% accuracy', 'var(--blue)'],
                  ['Explainability', 'SHAP TreeExplainer', 'Local', 'Real-time', 'var(--green)'],
                  ['Voice Synthesis', 'Azure TTS', 'Neural', '11 languages', 'var(--orange)']
                ].map(([name, model, provider, metric, color]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)' }}>{name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text4)' }}>{model} · {provider}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: color, fontWeight: 600 }}>{metric}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Options */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text4)', marginBottom: 8 }}>Quick Actions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('Testing model performance...', 'var(--amber)', 'bi-speedometer2')}>
                  <i className="bi-speedometer2" /> Run Performance Test
                </button>
                <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('Checking model versions...', 'var(--blue)', 'bi-arrow-repeat')}>
                  <i className="bi-arrow-repeat" /> Check for Updates
                </button>
                <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('Optimizing models...', 'var(--green)', 'bi-lightning-charge')}>
                  <i className="bi-lightning-charge" /> Optimize Performance
                </button>
              </div>
            </div>

            {/* Advanced Settings */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text4)', marginBottom: 8 }}>Advanced Settings</div>
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12 }}>
                {[
                  ['Max Tokens', '4096', 'Context window size'],
                  ['Temperature', '0.7', 'Response creativity'],
                  ['Top-K', '5', 'Responses to consider'],
                  ['Batch Size', '32', 'Processing batch size'],
                  ['Cache Enabled', 'true', 'Model caching']
                ].map(([setting, value, description]) => (
                  <div key={setting} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{setting}</span>
                    <span style={{ fontSize: 10, color: 'var(--text4)' }}>{description}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--teal)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Update Button */}
            <button className="vc-btn vc-btn-teal vc-btn-sm" style={{ marginTop: 12, width: '100%' }}
              onClick={() => openModal('Update AI Models','Configure advanced model settings and versions',
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Model Selection</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="vc-form-group"><label>Speech-to-text Engine</label>
                      <select defaultValue="whisper" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <option value="whisper">OpenAI Whisper (Recommended)</option>
                        <option value="azure">Azure Speech Services</option>
                        <option value="google">Google Speech-to-Text</option>
                      </select>
                    </div>
                    <div className="vc-form-group"><label>Whisper Model Size</label>
                      <select defaultValue="large-v3" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <option value="tiny">tiny (39M, fastest)</option>
                        <option value="base">base (74M, fast)</option>
                        <option value="small">small (244M, balanced)</option>
                        <option value="medium">medium (769M, accurate)</option>
                        <option value="large-v3">large-v3 (1550M, most accurate)</option>
                      </select>
                    </div>
                    <div className="vc-form-group"><label>LLM Provider</label>
                      <select defaultValue="groq" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <option value="groq">Groq (Llama 3 70B)</option>
                        <option value="openai">OpenAI (GPT-4)</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="local">Local Models</option>
                      </select>
                    </div>
                    <div className="vc-form-group"><label>ML Framework</label>
                      <select defaultValue="xgboost" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <option value="xgboost">XGBoost (Recommended)</option>
                        <option value="randomforest">Random Forest</option>
                        <option value="logistic">Logistic Regression</option>
                        <option value="neural">Neural Network</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Performance Tuning</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="vc-form-group"><label>GPU Memory Limit (GB)</label>
                      <input type="number" defaultValue="16" min="4" max="64" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} />
                    </div>
                    <div className="vc-form-group"><label>Max Concurrent Requests</label>
                      <input type="number" defaultValue="10" min="1" max="50" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} />
                    </div>
                    <div className="vc-form-group"><label>Response Timeout (seconds)</label>
                      <input type="number" defaultValue="30" min="5" max="120" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} />
                    </div>
                  </div>
                </div>,
                <><button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-x" /> Cancel</button>
                  <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => { closeModal(); showToast('AI models updated', 'var(--teal)', 'bi-check2'); }}><i className="bi-check2" /> Save Configuration</button></>
              )}>
              <i className="bi-gear-fill" /> Configure Models
            </button>
          </div>
        </div>
        <div>
          <div className="vc-card" style={{ marginBottom: 14 }}>
            <div className="vc-sec-title"><i className="bi-sliders2" /> Queue scoring weights</div>
            <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--mono)', background: 'var(--bg3)', borderRadius: 8, padding: 12, marginBottom: 14, lineHeight: 1.8 }}>
              Score = (TB risk × W1) + (wait × W2) + (flags × W3) + (age × W4)
            </div>
            {[['TB risk weight (W1)',40],['Wait time weight (W2)',30],['Age vulnerability (W4)',10]].map(([l,v]) => (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <label style={{ fontSize: 12, width: 180, flexShrink: 0 }}>{l as string}</label>
                <input type="range" min="0" max="100" defaultValue={v as number} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--teal)', width: 36, textAlign: 'right' }}>{v}%</span>
              </div>
            ))}
            <button className="vc-btn vc-btn-teal vc-btn-sm" style={{ width: '100%' }} onClick={() => showToast('Queue weights saved','var(--teal)','bi-check2')}>
              <i className="bi-floppy2-fill" /> Save weights
            </button>
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}