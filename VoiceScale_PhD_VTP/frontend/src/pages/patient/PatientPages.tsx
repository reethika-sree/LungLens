import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';
import { useModal } from '../../components/ModalProvider';
import { useProcessing } from '../../components/ProcessingProvider';
import AppLayout from '../AppLayout';
import RoleLayout from '../../layouts/RoleLayout';
import './PatientPages.css';
import { useVoiceProcess } from '../../hooks/useVoiceProcess';
import { useLanguage } from '../../contexts/LanguageContext';
import type { LangKey } from '../../contexts/translations';
import { patientApi } from '../../api/client';

// ═══════════════════════════════════════
// LANGUAGES DATA
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// LANGUAGES DATA — Strictly restricted to Telugu, Hindi, English
// ═══════════════════════════════════════
const LANGUAGES: { lang: LangKey; native: string; flag: string; desc: string }[] = [
  { lang:'Telugu',   native:'తెలుగు',    flag:'🇮🇳', desc:'మీ మాతృభాషలో మాట్లాడండి' },
  { lang:'Hindi',    native:'हिन्दी',    flag:'🇮🇳', desc:'अपनी भाषा में बात करें' },
  { lang:'English',  native:'English',   flag:'🇬🇧', desc:'Speak in English' },
];

// ═══════════════════════════════════════
// STEP 1 — LANGUAGE SELECT
// ═══════════════════════════════════════
export function PatientLanguagePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { language, setLanguage } = useLanguage();
  const [selected, setSelected] = useState<LangKey>(language);

  const selectLang = (lang: LangKey) => {
    setSelected(lang);
    setLanguage(lang);
    sessionStorage.setItem('selectedLanguage', lang);
    showToast(`Language set to ${lang}`, 'var(--teal)', 'bi-globe2');
    navigate('/patient/voice-capture', { state: { language: lang } });
  };

  return (
    <RoleLayout activeNav="screening" pageTitle="Language Selection">
      <div className="pt-onboard-shell" style={{ maxWidth: 840, margin: '0 auto', padding: '20px 0' }}>
        <div className="pt-onboard-hero" style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="pt-onboard-hero-title">Select your language / మీ భాషను ఎంచుకోండి</div>
          <div className="pt-onboard-hero-sub">Choose your preferred language for speech-based TB intake and follow-up consultation.</div>
        </div>

        <div className="pt-lang-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {LANGUAGES.map(l => (
            <button
              key={l.lang}
              className={`pt-lang-card ${selected===l.lang?'selected':''}`}
              onClick={() => selectLang(l.lang)}
              style={{
                padding: '28px 20px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <div className="ptlc-flag" style={{ fontSize: 36, marginBottom: 4 }}>{l.flag}</div>
              <div className="ptlc-native" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{l.native}</div>
              <div className="ptlc-en" style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}>{l.lang}</div>
              <div style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', marginTop: 4 }}>{l.desc}</div>
              {selected===l.lang && <div className="ptlc-check" style={{ marginTop: 10 }}><i className="bi-check-circle-fill" style={{ fontSize: 20, color: 'var(--teal)' }} /></div>}
            </button>
          ))}
        </div>
        <div style={{ height:32 }} />
      </div>
    </RoleLayout>
  );
}

// ═══════════════════════════════════════
// STEP 2 — VOICE INTAKE
// ═══════════════════════════════════════
export function PatientVoicePage() {
  const navigate           = useNavigate();
  const { showToast }      = useToast();
  const { showProcessing } = useProcessing();
  const { language, t }    = useLanguage();

  const {
    isRecording,
    done,
    seconds,
    result,
    error,
    startRecording,
    stopRecording,
    processVoice,
    reset,
  } = useVoiceProcess(language);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleStop = () => {
    stopRecording();
    showToast(t.recordingDone, 'var(--teal)', 'bi-mic-fill');
  };

  const handleProcess = async () => {
    console.log('%c[PatientVoicePage] handleProcess() called', 'color:#0ff;font-weight:bold');

    // 1. Run the real API call FIRST — capture result before showing any overlay
    const res = await processVoice();
    console.log('%c[PatientVoicePage] processVoice() returned:', 'color:#0ff;font-weight:bold', res);

    if (!res) {
      console.error('[PatientVoicePage] processVoice returned null — showing error toast');
      showToast(t.processingFailed, 'var(--red)', 'bi-exclamation-triangle-fill');
      return;
    }

    // 2. Show the visual overlay AFTER we have the result.
    //    Navigate inside the onDone callback so the overlay is fully closed first —
    //    this prevents the overlay from re-rendering on top of the confirm page
    //    and prevents location.state from being clobbered by the overlay teardown.
    console.log('%c[PatientVoicePage] Starting processing overlay — will navigate on done', 'color:#0ff;font-weight:bold');
    showProcessing(
      [
        'Whisper large-v3 — transcribing speech',
        'IndicTrans2 — translating to English',
        'Llama 3 — extracting symptoms to JSON',
        'XGBoost — calculating TB risk score',
        'SHAP — generating explainability data',
        'Queue engine — assigning P1–P5 priority',
      ],
      t.processVoice + '…',
      () => {
        console.log('%c[PatientVoicePage] Overlay done — navigating to /patient/confirm with result:', 'color:#0ff;font-weight:bold', res);
        navigate('/patient/confirm', { state: { voiceResult: res } });
      },
    );
  };

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">{t.speakSymptoms}</div>
          <div className="vc-ph-sub">{t.tapMicSub}</div>
        </div>

        <div className="voice-center">
          <div className="lang-pill-display">
            <i className="bi-globe2" style={{ color: 'var(--teal)' }} />
            {language} — {LANGUAGES.find(l => l.lang === language)?.native || language}
          </div>

          <div className="mic-outer">
            {isRecording &&
              [1, 2, 3].map(i => (
                <div key={i} className="mic-ring" style={{ width: 80 + i * 36, height: 80 + i * 36 }} />
              ))}
            <button
              className={`mic-btn-big ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? handleStop : startRecording}
            >
              <i
                className={isRecording ? 'bi-stop-fill' : 'bi-mic-fill'}
                style={{ fontSize: 30, color: '#fff' }}
              />
            </button>
          </div>

          <div className="voice-timer" style={{ color: isRecording ? 'var(--red)' : 'var(--text2)' }}>
            {fmt(seconds)}
          </div>

          <div className="voice-label">
            {isRecording
              ? t.recordingSpeak
              : done
              ? t.recordingDone
              : t.tapMicSpeak}
          </div>

          {error && (
            <div className="vc-alert vc-alert-red" style={{ marginTop: 10 }}>
              <i className="bi-exclamation-triangle-fill" /> {error}
            </div>
          )}

          <div className="waveform">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`wb ${isRecording ? 'active' : ''}`} style={{ animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>

          <div className="voice-actions">
            <button
              className="vc-btn vc-btn-teal"
              onClick={handleProcess}
              disabled={!done}
              style={{ opacity: done ? 1 : 0.45 }}
            >
              <i className="bi-cpu" /> {t.processVoice}
            </button>
            {(done || error) && (
              <button className="vc-btn vc-btn-ghost" onClick={reset}>
                <i className="bi-arrow-counterclockwise" /> {t.reRecord}
              </button>
            )}
            <button className="vc-btn vc-btn-teal" onClick={() => navigate('/patient/chat')}>
              <i className="bi-chat-dots" /> {t.switchToChat}
            </button>
            <button className="vc-btn vc-btn-ghost" onClick={() => navigate('/patient/language')}>
              <i className="bi-arrow-left" /> {t.changeLanguageBtn}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// STEP 3 — AI CHAT
// ═══════════════════════════════════════
const CHAT_FLOW = [
  { bot: 'నమస్కారం! I\'m LungLens AI. <b>How long have you had this cough?</b>' },
  { user:'రెండు నెలల నుండి దగ్గు వస్తోంది', bot:'Understood — 8 weeks of cough noted. <b>Do you have fever, especially at night?</b>' },
  { user:'అవును, రాత్రి జ్వరం వస్తోంది', bot:'Night fever noted. <b>Have you lost weight recently without trying to?</b>' },
  { user:'అవును బరువు తగ్గిపోయాను', bot:'Weight loss noted. <b>Do you cough up any blood?</b>' },
  { user:'లేదు రక్తం రాలేదు', bot:'Good — no hemoptysis. <b>What is your occupation?</b>' },
  { user:'వ్యవసాయం చేస్తాను — I am a farmer', bot:'Farmer noted. <b>Has anyone in your household had TB before?</b>' },
  { user:'తెలియదు — Not sure', bot:'Understood. I have enough information. <b>Tap "View summary" to review your symptoms.</b>' },
];

interface ChatMsg { type:'bot'|'user'; msg:string; }

export function PatientChatPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [msgs, setMsgs]   = useState<ChatMsg[]>([{ type:'bot', msg:CHAT_FLOW[0].bot }]);
  const [input, setInput] = useState('');
  const [step, setStep]   = useState(0);
  const [typing, setTyping] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (areaRef.current) areaRef.current.scrollTop = areaRef.current.scrollHeight; }, [msgs, typing]);

  const send = () => {
    if (step >= CHAT_FLOW.length-1) { navigate('/patient/confirm'); return; }
    const flow = CHAT_FLOW[step+1] as { user:string; bot:string };
    const userMsg = input.trim() || flow.user;
    setInput(''); setMsgs(p => [...p, { type:'user', msg:userMsg }]); setTyping(true);
    setTimeout(() => { setTyping(false); setMsgs(p => [...p, { type:'bot', msg:flow.bot }]); setStep(s=>s+1); }, 900);
  };

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">{t.aiInterview}</div>
          <div className="vc-ph-sub">{t.aiInterviewSub}</div>
        </div>
        <div className="chat-container">
          <div className="chat-area" ref={areaRef}>
            {msgs.map((m,i) => (
              <div key={i} className={`chat-msg ${m.type}`}>
                <div className={`chat-av ${m.type}`}>
                  <i className={m.type==='bot'?'bi-robot':'bi-person-fill'} style={{ fontSize:14 }} />
                </div>
                <div className={`chat-bubble ${m.type}`} dangerouslySetInnerHTML={{ __html:m.msg }} />
              </div>
            ))}
            {typing && (
              <div className="chat-msg bot">
                <div className="chat-av bot"><i className="bi-robot" style={{ fontSize:14 }} /></div>
                <div className="chat-bubble bot">
                  <div className="typing-dots">
                    {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ animationDelay:`${i*.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="chat-input-row">
            <button className="vc-btn vc-btn-ghost" style={{ padding:'10px 12px' }}>
              <i className="bi-mic-fill" style={{ fontSize:16 }} />
            </button>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && send()}
              placeholder={t.typeAnswer}
            />
            <button className="vc-btn vc-btn-blue" onClick={send} style={{ padding:'10px 16px' }}>
              {step >= CHAT_FLOW.length-1
                ? <><i className="bi-arrow-right" /> {t.summary}</>
                : <><i className="bi-send-fill" /> {t.send}</>}
            </button>
          </div>
          <button className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop:8 }}
            onClick={() => navigate('/patient/confirm')}>
            <i className="bi-skip-forward-fill" /> {t.skipToSummary}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// STEP 4 — CONFIRM SYMPTOMS
// ═══════════════════════════════════════
export function PatientConfirmPage() {
  const navigate        = useNavigate();
  const location        = useLocation();
  const { showToast }   = useToast();
  const { language, t } = useLanguage();

  // Real voice result passed via navigate('/patient/confirm', { state: { voiceResult: res } })
  const vr = (location.state as any)?.voiceResult as {
    language:           string;
    local_transcript:   string;
    english_transcript: string;
    local_audio_b64:    string;
    english_audio_b64:  string;
  } | undefined;

  const playAudio = (b64: string) => {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audio.play();
    } catch {
      showToast('Audio playback failed', 'var(--red)', 'bi-volume-mute-fill');
    }
  };

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">{t.isCorrect}</div>
          <div className="vc-ph-sub">{t.isCorrectSub}</div>
        </div>

        <div style={{ maxWidth:520, display:'flex', flexDirection:'column', gap:14 }}>

          {/* ── What you said (local language transcript) ── */}
          <div className="vc-card">
            <div className="vc-sec-title">
              <i className="bi-mic-fill" /> {t.whatYouSaid} ({vr?.language ?? language})
            </div>
            <div style={{ background:'var(--bg3)', borderRadius:8, padding:14, fontSize:15,
                          color:'var(--text2)', lineHeight:1.9,
                          borderLeft:'3px solid var(--teal)', fontStyle:'italic' }}>
              {vr?.local_transcript
                ? `"${vr.local_transcript}"`
                : <span style={{ color:'var(--text4)', fontStyle:'normal' }}>⚠ No transcript — try recording again</span>
              }
            </div>
            {vr?.local_audio_b64 && (
              <button className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop:10 }}
                onClick={() => playAudio(vr.local_audio_b64)}>
                <i className="bi-volume-up-fill" /> Play in {vr.language}
              </button>
            )}
            <div style={{ fontSize:11, color:'var(--text4)', marginTop:8, fontFamily:'var(--mono)' }}>
              Transcribed via Whisper large-v3 · Language: {vr?.language ?? language}
            </div>
          </div>

          {/* ── English translation — always shown when available ── */}
          {vr?.english_transcript && (
            <div className="vc-card">
              <div className="vc-sec-title">
                <i className="bi-translate" /> English translation (IndicTrans2)
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:8, padding:14, fontSize:15,
                            color:'var(--text2)', lineHeight:1.9,
                            borderLeft:'3px solid var(--blue)', fontStyle:'italic' }}>
                {`"${vr.english_transcript}"`}
              </div>
              {vr.english_audio_b64 && (
                <button className="vc-btn vc-btn-ghost vc-btn-sm" style={{ marginTop:10 }}
                  onClick={() => playAudio(vr.english_audio_b64)}>
                  <i className="bi-volume-up-fill" /> Play in English
                </button>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button className="vc-btn vc-btn-teal" style={{ flex:1 }}
              onClick={() => {
                navigate('/patient/ticket');
                showToast(t.correctGetTicket, 'var(--teal)', 'bi-check-circle-fill');
              }}>
              <i className="bi-check-lg" /> {t.correctGetTicket}
            </button>
            <button className="vc-btn vc-btn-ghost" onClick={() => navigate('/patient/voice')}>
              <i className="bi-mic-fill" /> {t.reRecordBtn}
            </button>
            <button className="vc-btn vc-btn-ghost" onClick={() => navigate('/patient/chat')}>
              <i className="bi-chat-dots" /> {t.reInterviewBtn}
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}


export function PatientTicketPage() {
  const navigate    = useNavigate();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();
  const { t } = useLanguage();

  const registerPhone = () => {
    openModal(
      t.phoneNumber,
      t.registerReminders,
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div className="vc-form-group"><label>{t.phoneNumber}</label><input placeholder="+91 98765 43210" /></div>
        <div className="vc-form-group"><label>{t.preferredLanguage}</label>
          <select>
            {['English','Hindi','Telugu','Tamil','Kannada','Marathi','Bengali','Gujarati','Punjabi','Odia','Malayalam'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="vc-alert vc-alert-teal"><i className="bi-info-circle" /> {t.otpNote}</div>
      </div>,
      <>
        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}><i className="bi-x" /> {t.cancel}</button>
        <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => { closeModal(); showToast(t.registerReminders,'var(--teal)','bi-phone-fill'); }}>
          <i className="bi-check2" /> {t.register}
        </button>
      </>
    );
  };

  return (
    <AppLayout>
      <div className="vc-page">
        <div className="vc-page-header">
          <div className="vc-ph-title">{t.yourTicket}</div>
          <div className="vc-ph-sub">{t.yourTicketSub}</div>
        </div>
        <div style={{ maxWidth:380 }}>
          <div className="ticket-card">
            <div className="ticket-top-bar" />
            <div className="vc-sec-title" style={{ marginBottom:6 }}><i className="bi-ticket-perforated" /> {t.priorityLevel}</div>
            <div className="ticket-priority">P1</div>
            <div style={{ fontSize:12, color:'var(--text4)', marginBottom:20 }}>{t.criticalLabel}</div>
            <div className="vc-divider" />
            <div className="ticket-wait">~8<span style={{ fontSize:24 }}>min</span></div>
            <div style={{ fontSize:11, color:'var(--text4)', marginBottom:22 }}>{t.estimatedWait}</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text4)', padding:'7px 14px', background:'var(--bg3)', borderRadius:6, display:'inline-block', marginBottom:20 }}>
              TKT-2024-0847 · PHC-CHITTOOR
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => showToast('WhatsApp notification sent','var(--teal)','bi-whatsapp')}>
                <i className="bi-whatsapp" /> {t.whatsappNotify}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// STEP 1.5 — QUESTIONS PAGE
// ═══════════════════════════════════════
interface QuestionAnswer {
  [key: string]: string;
}

export function PatientQuestionsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [answers, setAnswers] = useState<QuestionAnswer>({});

  const questions = [
    // Main Symptoms
    { key: 'coughPhlegm', category: 'mainSymptoms' },
    { key: 'coughingBlood', category: 'mainSymptoms' },
    { key: 'sputumBlood', category: 'mainSymptoms' },
    { key: 'shortnessBreath', category: 'mainSymptoms' },
    // Systemic Symptoms
    { key: 'fever', category: 'systemicSymptoms' },
    { key: 'nightSweats', category: 'systemicSymptoms' },
    { key: 'weightLoss', category: 'systemicSymptoms' },
    { key: 'tiredBody', category: 'systemicSymptoms' },
    // Pain & Physical Signs
    { key: 'chestPain', category: 'painPhysicalSigns' },
    { key: 'backPain', category: 'painPhysicalSigns' },
    { key: 'swollenLymph', category: 'painPhysicalSigns' },
    { key: 'lumpsArmpitsNeck', category: 'painPhysicalSigns' },
    { key: 'lossAppetite', category: 'painPhysicalSigns' },
  ];

  const handleAnswerChange = (questionKey: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionKey]: value
    }));
  };

  const totalQuestions = questions.length; // 13
  const answeredCount = Object.values(answers).filter(v => v === 'yes' || v === 'no').length;
  const allAnswered = answeredCount === totalQuestions;

  const handleNext = async () => {
    if (!allAnswered) return;
    // Store answers in sessionStorage to pass to next step
    sessionStorage.setItem('questionAnswers', JSON.stringify(answers));
    try {
      const res = await patientApi.submitSymptomAnswers(answers);
      sessionStorage.setItem('record_id', res.data.record_id);
    } catch {
      // Offline / auth issue — still proceed locally
    }
    // Navigate to prediction page
    navigate('/patient/prediction');
  };

  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, typeof questions>);

  return (
    <AppLayout>
      <div className="vc-page" style={{ width: '100vw', maxWidth: '100vw', margin: '0', padding: '20px' }}>
        <div className="vc-page-header" style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="vc-ph-title">{t.questionsTitle}</div>
          <div className="vc-ph-sub">{t.questionsSub}</div>
        </div>

        <div style={{ width: '100%', maxWidth: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
              <div key={category} className="vc-card" style={{ 
                padding: '28px', 
                borderRadius: '16px', 
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                width: '100%',
                minWidth: '320px'
              }}>
                <div className="vc-sec-title" style={{ 
                  marginBottom: 20, 
                  fontSize: 16, 
                  fontWeight: 700, 
                  color: 'var(--text)',
                  borderBottom: '2px solid var(--teal)',
                  paddingBottom: 8
                }}>
                  {t[category as keyof typeof t]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {categoryQuestions.map(q => (
                    <div key={q.key} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      backgroundColor: 'var(--bg3)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--teal-a)';
                      e.currentTarget.style.borderColor = 'var(--teal)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg3)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}>
                      <label style={{ 
                        flexShrink: 1, 
                        fontSize: 14, 
                        color: 'var(--text1)', 
                        marginRight: 12, 
                        lineHeight: 1.4, 
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}>
                        {t[q.key as keyof typeof t]}
                      </label>
                      <select
                        value={answers[q.key] || ''}
                        onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '2px solid var(--border)',
                          backgroundColor: 'var(--bg1)',
                          color: 'var(--text1)',
                          fontSize: 13,
                          minWidth: 60,
                          width: 80,
                          flexShrink: 0,
                          height: '36px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'var(--teal)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0,232,181,0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="" disabled>Select</option>
                        <option value="yes">{t.yes}</option>
                        <option value="no">{t.no}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 440, margin: '32px auto 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text4)' }}>
                {answeredCount} of {totalQuestions} answered
              </span>
              {allAnswered && (
                <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 600 }}>
                  <i className="bi-check-circle-fill" style={{ marginRight: 4 }} />All done!
                </span>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--bg3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(answeredCount / totalQuestions) * 100}%`,
                background: allAnswered ? 'var(--teal)' : 'var(--blue)',
                borderRadius: 99,
                transition: 'width 0.3s ease, background 0.3s ease',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center', width: '100%', padding: '0 20px' }}>
            <button
              className="vc-btn vc-btn-teal"
              onClick={handleNext}
              disabled={!allAnswered}
              title={!allAnswered ? `Please answer all ${totalQuestions} questions to continue` : ''}
              style={{ 
                flex: 1, 
                maxWidth: 400,
                padding: '16px 24px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: '12px',
                height: '48px',
                opacity: allAnswered ? 1 : 0.45,
                cursor: allAnswered ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.2s ease',
              }}
            >
              <i className="bi-arrow-right" /> {allAnswered ? t.nextStep : `Answer ${totalQuestions - answeredCount} more to continue`}
            </button>
            <button
              className="vc-btn vc-btn-ghost"
              onClick={() => navigate('/patient/language')}
              style={{ 
                padding: '16px 24px',
                fontSize: 14,
                borderRadius: '12px',
                height: '48px',
                borderColor: 'var(--border)'
              }}
            >
              <i className="bi-arrow-left" /> {t.changeLanguageBtn}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════
// STEP 2 — MODE SELECTION
// ═══════════════════════════════════════
export function PatientModePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="pt-onboard-shell">
        <div className="pt-onboard-hero">
          <div className="pt-onboard-hero-icon">🎯</div>
          <div className="pt-onboard-hero-title">{t.chooseMode}</div>
        </div>

        <div className="pt-mode-grid">
          <button
            className="pt-mode-card"
            onClick={() => navigate('/patient/voice')}
          >
            <div className="ptmc-icon">🎙️</div>
            <div className="ptmc-title">{t.voiceTitle}</div>
            <div className="ptmc-desc">{t.voiceDesc}</div>
            <div className="ptmc-tags">
              <span className="ptmc-tag">{t.voiceTag1}</span>
              <span className="ptmc-tag">{t.voiceTag2}</span>
              <span className="ptmc-tag">{t.voiceTag3}</span>
            </div>
            <div className="ptmc-cta">{t.voiceCta}</div>
          </button>

          <button
            className="pt-mode-card"
            onClick={() => navigate('/patient/chat')}
          >
            <div className="ptmc-icon">💬</div>
            <div className="ptmc-title">{t.chatTitle}</div>
            <div className="ptmc-desc">{t.chatDesc}</div>
            <div className="ptmc-tags">
              <span className="ptmc-tag">{t.chatTag1}</span>
              <span className="ptmc-tag">{t.chatTag2}</span>
              <span className="ptmc-tag">{t.chatTag3}</span>
            </div>
            <div className="ptmc-cta">{t.chatCta}</div>
          </button>
        </div>

        <div style={{ height: 32 }} />
        
        <button
          className="vc-btn vc-btn-ghost"
          onClick={() => navigate('/patient/questions')}
          style={{ margin: '0 auto', display: 'block' }}
        >
          <i className="bi-arrow-left" /> {t.changeLanguageBtn}
        </button>
      </div>
    </AppLayout>
  );
}

/* PatientHistory re-export handled in PatientHistoryPage.tsx */