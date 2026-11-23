import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../contexts/AuthContext';
import { patientApi, DotsCheckin, DotsStats } from '../../api/client';
import RoleLayout from '../../layouts/RoleLayout';

export function PatientHistoryPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all'|'visit'|'test'|'action'>('all');
  const [animated, setAnimated] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Real DOTS state — replaces Math.random()
  const [dotsGrid, setDotsGrid]   = useState<DotsCheckin[]>([]);
  const [dotsStats, setDotsStats] = useState<DotsStats>({ pct: 0, taken: 0, missed: 0, consecutive_missed: 0 });
  const [dotsLoading, setDotsLoading] = useState(true);

  // Live queue status
  const [queueStatus, setQueueStatus] = useState<any>(null);

  useEffect(() => { setTimeout(() => setAnimated(true), 120); }, []);

  useEffect(() => {
    fetchPatientRecords();
    fetchDotsData();
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchPatientRecords = async () => {
    try {
      setLoading(true);
      const response = await patientApi.getMyRecords();
      setRecords(response.data);
    } catch (error) {
      console.error('Failed to fetch patient records:', error);
      showToast('Could not load patient records', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLoading(false);
    }
  };

  const fetchDotsData = async () => {
    try {
      setDotsLoading(true);
      const response = await patientApi.getMyCheckins(30);
      setDotsGrid(response.data.grid);
      setDotsStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch DOTS data:', error);
    } finally {
      setDotsLoading(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const response = await patientApi.getQueueStatus();
      setQueueStatus(response.data);
    } catch { /* non-critical */ }
  };

  const visits = records.flatMap(record => {
    const timeline: any[] = [];
    const createdAt = new Date(record.created_at);

    if (record.tb_risk_level) {
      timeline.push({
        type: 'visit',
        date: createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        label: 'PHC · AI Triage',
        title: `Initial consultation — ${record.tb_risk_level.toUpperCase()} risk`,
        detail: `AI TB risk ${record.tb_risk_score}%. Language: ${record.language || 'Unknown'}.`,
        tags: [`${record.tb_risk_level.toUpperCase()} Risk`, `TB risk ${record.tb_risk_score}%`, 'AI Triage'],
        dot: record.tb_risk_level === 'high' ? 'var(--red)' : record.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)',
      });
    }
    if (record.voice_transcript) {
      timeline.push({
        type: 'action',
        date: createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        label: 'Voice recording',
        title: 'Patient voice captured',
        detail: `Voice transcript recorded in ${record.language || 'unknown'}`,
        tags: ['Voice captured', record.language || 'Unknown'],
        dot: 'var(--blue)',
      });
    }
    if (record.symptom_answers) {
      const symptomCount = Object.values(record.symptom_answers).filter(v => v === 'yes').length;
      timeline.push({
        type: 'test',
        date: createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        label: 'Symptom assessment',
        title: `${symptomCount} positive symptoms`,
        detail: `Patient reported ${symptomCount} out of 13 symptoms.`,
        tags: [`${symptomCount}/13 symptoms`, 'Assessment complete'],
        dot: symptomCount > 5 ? 'var(--red)' : symptomCount > 2 ? 'var(--amber)' : 'var(--green)',
      });
    }
    return timeline;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = filter === 'all' ? visits : visits.filter(v => v.type === filter);

  const tagColor = (t: string) => {
    if (t.includes('negative') || t.includes('Good') || t.includes('taken') || t.includes('DOTS active'))
      return { bg: 'var(--green-a)', color: 'var(--green)', border: 'rgba(62,232,160,.2)' };
    if (t.includes('HIGH') || t.includes('confirmed') || t.includes('Referred'))
      return { bg: 'var(--red-a)', color: 'var(--red)', border: 'rgba(239,68,68,.2)' };
    if (t.includes('Voice') || t.includes('symptoms') || t.includes('Assessment'))
      return { bg: 'var(--bg3)', color: 'var(--text3)', border: 'var(--border)' };
    return { bg: 'var(--amber-a)', color: 'var(--amber)', border: 'rgba(247,187,74,.2)' };
  };

  const latestRecord = records[0];
  const riskBars = records.slice(0, 5).map((record, index) => ({
    label: index === 0 ? 'Latest' : new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    pct:   record.tb_risk_score || 0,
    color: record.tb_risk_level === 'high' ? 'var(--red)' : record.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)',
  }));

  const tests = records.flatMap(record => {
    const out: any[] = [];
    if (record.tb_risk_score !== undefined) {
      out.push({
        name:   'AI TB Risk Assessment',
        date:   new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        result: `${record.tb_risk_score}% risk`,
        cls:    record.tb_risk_level === 'high' ? 'pos' : record.tb_risk_level === 'medium' ? 'pend' : 'neg',
      });
    }
    if (record.voice_transcript) {
      out.push({
        name: 'Voice Capture', date: new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        result: 'Captured', cls: 'neg',
      });
    }
    return out;
  }).slice(0, 6);

  const dotsCellColor   = (c: DotsCheckin) => c.taken === null ? 'var(--bg3)' : c.taken ? 'var(--green)' : 'var(--red)';
  const dotsCellOpacity = (c: DotsCheckin) => c.taken === null ? 0.4 : c.taken ? 0.85 : 0.7;

  return (
    <RoleLayout activeNav="history" pageTitle="Health & DOTS Records">
      <div className="vc-page">
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300, flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:24, color:'var(--text4)' }}><i className="bi-hourglass-split" /></div>
            <div style={{ fontSize:14, color:'var(--text4)' }}>Loading patient records...</div>
          </div>
        ) : (
          <>
            <div className="vc-page-header">
              <div className="vc-ph-row">
                <div>
                  <div className="vc-ph-title">Patient history</div>
                  <div className="vc-ph-sub">Complete clinical record · {user?.full_name || 'Loading...'}</div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {queueStatus?.queue_position && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--amber)', background:'var(--amber-a)', border:'1px solid rgba(247,187,74,.2)', borderRadius:20, padding:'4px 12px' }}>
                      <i className="bi-clock" /> Queue: #{queueStatus.queue_position} · ~{queueStatus.estimated_wait_time}
                    </div>
                  )}
                  <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('PDF downloaded','var(--teal)','bi-download')}>
                    <i className="bi-download" /> Download
                  </button>
                </div>
              </div>
            </div>

            {/* Profile card */}
            <div className="vc-card" style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:14, flexWrap:'wrap' }}>
              <div style={{ width:50, height:50, borderRadius:'50%', background:'var(--blue-a)', color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0 }}>
                {(user?.full_name || '??').split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:2 }}>{user?.full_name || 'Loading...'}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>
                  {records.length} record{records.length !== 1 ? 's' : ''} · {latestRecord?.language || 'Unknown language'} · {latestRecord?.tb_risk_level ? `${latestRecord.tb_risk_level.toUpperCase()} risk` : 'Risk pending'}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {latestRecord?.tb_risk_level && [
                    [`${latestRecord.tb_risk_level.toUpperCase()} risk`, latestRecord.tb_risk_level === 'high' ? 'var(--red)' : latestRecord.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)'],
                    [`${records.length} record${records.length !== 1 ? 's' : ''}`, 'var(--blue)'],
                    ['AI Triage', 'var(--teal)'],
                  ].map(([t,c]) => (
                    <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:`${c}18`, color:c, border:`1px solid ${c}30` }}>{t}</span>
                  ))}
                </div>
              </div>
              <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => showToast('WhatsApp sent','var(--teal)','bi-whatsapp')}>
                <i className="bi-whatsapp" /> WhatsApp
              </button>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
              {[
                ['Latest TB risk', `${latestRecord?.tb_risk_score || 0}%`, latestRecord?.tb_risk_level === 'high' ? 'var(--red)' : latestRecord?.tb_risk_level === 'medium' ? 'var(--amber)' : 'var(--green)', 'bi-activity'],
                ['Total records', records.length.toString(), 'var(--text)', 'bi-calendar'],
                ['DOTS adherence', dotsLoading ? '…' : `${dotsStats.pct}%`, dotsStats.pct >= 80 ? 'var(--green)' : dotsStats.pct >= 60 ? 'var(--amber)' : 'var(--red)', 'bi-capsule-pill'],
                ['Last assessment', latestRecord ? new Date(latestRecord.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' }) : '—', 'var(--text)', 'bi-clock'],
              ].map(([l,v,c,ico]) => (
                <div key={l} style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--text4)', display:'flex', alignItems:'center', gap:5, marginBottom:5 }}><i className={ico as string} />{l}</div>
                  <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr minmax(0,280px)', gap:14 }}>
              <div>
                <div className="vc-card">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                    <div className="vc-sec-title" style={{ marginBottom:0 }}><i className="bi-clock-history" /> Visit timeline</div>
                    <div style={{ display:'flex', gap:4 }}>
                      {(['all','visit','test','action'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${filter===f?'var(--teal)':'var(--border)'}`, background:filter===f?'var(--teal-a)':'transparent', color:filter===f?'var(--teal)':'var(--text3)', fontSize:11, cursor:'pointer', fontFamily:'var(--body)', fontWeight:filter===f?600:400 }}>
                          {f === 'all' ? 'All' : f[0].toUpperCase()+f.slice(1)+'s'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filtered.length === 0 ? (
                    <div style={{ textAlign:'center', color:'var(--text4)', fontSize:13, padding:'24px 0' }}>
                      <i className="bi-journal-x" style={{ fontSize:24, display:'block', marginBottom:8 }} />
                      No records yet. Complete a voice consultation to see your history.
                    </div>
                  ) : filtered.map((v,i) => (
                    <div key={i} style={{ display:'flex', gap:12, paddingBottom:14, borderBottom:i<filtered.length-1?'1px solid var(--border)':undefined, marginBottom:i<filtered.length-1?14:0 }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:16, flexShrink:0, paddingTop:3 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:v.dot, flexShrink:0 }} />
                        {i < filtered.length-1 && <div style={{ flex:1, width:1.5, background:'var(--border)', marginTop:4, minHeight:16 }} />}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:'var(--text4)', marginBottom:3 }}>{v.date} · {v.label}</div>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{v.title}</div>
                        <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.6, marginBottom:6 }}>{v.detail}</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                          {v.tags.map((t:string) => {
                            const s = tagColor(t);
                            return <span key={t} style={{ fontSize:11, fontWeight:500, padding:'2px 9px', borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{t}</span>;
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Risk over time */}
                <div className="vc-card">
                  <div className="vc-sec-title"><i className="bi-activity" /> TB risk over time</div>
                  {riskBars.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--text4)', textAlign:'center', padding:'12px 0' }}>No risk data yet</div>
                  ) : riskBars.map((b,i) => (
                    <div key={i} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                        <span style={{ color:'var(--text3)' }}>{b.label}</span>
                        <span style={{ fontWeight:700, color:b.color }}>{b.pct}%</span>
                      </div>
                      <div style={{ height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ width:animated?`${b.pct}%`:'0', height:'100%', background:b.color, borderRadius:3, transition:`width .8s ease ${i*.15}s` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Test results */}
                <div className="vc-card">
                  <div className="vc-sec-title"><i className="bi-flask" /> Test results</div>
                  {tests.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--text4)', textAlign:'center', padding:'12px 0' }}>No test results yet</div>
                  ) : tests.map((t,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:i<tests.length-1?'1px solid var(--border)':undefined }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500 }}>{t.name}</div>
                        <div style={{ fontSize:11, color:'var(--text4)' }}>{t.date}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:t.cls==='neg'?'var(--green-a)':t.cls==='pos'?'var(--red-a)':'var(--amber-a)', color:t.cls==='neg'?'var(--green)':t.cls==='pos'?'var(--red)':'var(--amber)', border:`1px solid ${t.cls==='neg'?'rgba(62,232,160,.2)':t.cls==='pos'?'rgba(239,68,68,.2)':'rgba(247,187,74,.2)'}`, whiteSpace:'nowrap' }}>
                        {t.result}
                      </span>
                    </div>
                  ))}
                </div>

                {/* DOTS adherence — REAL MongoDB data */}
                <div className="vc-card">
                  <div className="vc-sec-title"><i className="bi-capsule-pill" /> DOTS adherence</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                    <span style={{ color:'var(--text3)' }}>Last 30 days</span>
                    {dotsLoading ? (
                      <span style={{ color:'var(--text4)' }}>Loading...</span>
                    ) : (
                      <span style={{ fontWeight:700, color:dotsStats.pct >= 80 ? 'var(--green)' : dotsStats.pct >= 60 ? 'var(--amber)' : dotsStats.pct > 0 ? 'var(--red)' : 'var(--text4)' }}>
                        {dotsStats.pct > 0 ? `${dotsStats.pct}%` : 'No data'}
                      </span>
                    )}
                  </div>

                  {dotsLoading ? (
                    <div style={{ height:40, background:'var(--bg3)', borderRadius:4, marginBottom:8 }} />
                  ) : dotsGrid.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--text4)', textAlign:'center', padding:'10px 0', marginBottom:8 }}>
                      No DOTS check-ins recorded yet.<br />Your ASHA worker logs these daily.
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:3, marginBottom:8 }}>
                      {dotsGrid.map((cell,i) => (
                        <div key={i}
                          title={`${cell.date}: ${cell.taken === null ? 'No data' : cell.taken ? 'Taken ✅' : 'Missed ❌'}${cell.note ? ` — ${cell.note}` : ''}`}
                          style={{ height:12, borderRadius:2, background:dotsCellColor(cell), opacity:dotsCellOpacity(cell), cursor:'default' }} />
                      ))}
                    </div>
                  )}

                  {!dotsLoading && (dotsStats.taken + dotsStats.missed > 0) && (
                    <div style={{ fontSize:11, color:'var(--text4)', marginBottom:6 }}>
                      {dotsStats.taken} taken · {dotsStats.missed} missed
                      {dotsStats.consecutive_missed > 0 && (
                        <span style={{ color:'var(--red)', marginLeft:6 }}>
                          · {dotsStats.consecutive_missed} in a row ⚠️
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text4)' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:2, background:'var(--green)' }} />Taken</span>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:2, background:'var(--red)' }} />Missed</span>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:2, background:'var(--bg3)', border:'1px solid var(--border)' }} />No data</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </RoleLayout>
  );
}