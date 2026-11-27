import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoleLayout from '../../layouts/RoleLayout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../components/ToastProvider';
import { useAppDispatch } from '../../store/hooks';
import { updateSymptoms, resetTriage } from '../../store/slices/triageSlice';
import { nlpApi } from '../../api/client';
import '../../styles/Dashboard.css';

/* ── Speech Recognition Language Codes ── */
const LANG_BCP47: Record<string, string> = {
  Telugu:  'te-IN',
  Hindi:   'hi-IN',
  English: 'en-IN',
};

const SYMPTOM_LABELS: Record<string, { en: string; te: string; hi: string }> = {
  cough_weeks:     { en: 'Cough Duration', te: 'దగ్గు కాలపరిమితి', hi: 'खांसी की अवधि' },
  hemoptysis:      { en: 'Blood in Sputum', te: 'దగ్గులో రక్తం', hi: 'बलगम में खून' },
  night_fever:     { en: 'Night/Evening Fever', te: 'రాత్రి జ్వరం', hi: 'रात का बुखार' },
  weight_loss:     { en: 'Weight Loss', te: 'బరువు తగ్గడం', hi: 'वजन कम होना' },
  night_sweats:    { en: 'Night Sweats', te: 'రాత్రి చెమటలు', hi: 'रात में पसीना' },
  dyspnea:         { en: 'Difficulty Breathing', te: 'శ్వాస తీసుకోవడంలో ఇబ్బంది', hi: 'सांस लेने में तकलीफ' },
  chest_pain:      { en: 'Chest Pain', te: 'ఛాతీ నొప్పి', hi: 'सीने में दर्द' },
  cough_phlegm:    { en: 'Productive Phlegm', te: 'కఫంతో దగ్గు', hi: 'बलगम वाली खांसी' },
  loss_appetite:   { en: 'Loss of Appetite', te: 'ఆకలి లేకపోవడం', hi: 'भूख न लगना' },
  contact_tb:      { en: 'Household TB Contact', te: 'ఇంట్లో టీబీ పరిచయం', hi: 'घर में टीबी संपर्क' },
  occupation_risk: { en: 'Occupational Dust Risk', te: 'గని/ధూళి పని', hi: 'धूल/खनन कार्य' },
  swollen_lymph:   { en: 'Swollen Lymph Nodes', te: 'మెడ గడ్డలు', hi: 'गले की गांठ' },
};

interface Message {
  sender: 'ai' | 'patient';
  text: string;
  time: string;
}

export default function PatientDynamicDialoguePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { language } = useLanguage();
  const dispatch = useAppDispatch();

  const rawLang: string =
    (location.state as any)?.language ||
    sessionStorage.getItem('selectedLanguage') ||
    language ||
    'English';
  const lang: 'Telugu' | 'Hindi' | 'English' =
    rawLang === 'Telugu' || rawLang === 'Hindi' || rawLang === 'English' ? rawLang : 'English';

  const navVoiceText = ((location.state as any)?.voiceText || '').trim();
  const initialVoiceText = navVoiceText || (sessionStorage.getItem('voiceCaptureText') || '').trim();

  const [messages, setMessages] = useState<Message[]>([]);
  const [symptoms, setSymptoms] = useState<Record<string, any>>({});
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [targetSymptom, setTargetSymptom] = useState<string | null>(null);
  const [dialogueState, setDialogueState] = useState<any>(null);
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [recording, setRecording] = useState(false);

  const recogRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const startedKeyRef = useRef<string | null>(null);

  const persistDialogueSnapshot = (
    msgs: Message[],
    syms: Record<string, any>,
    st: any,
    q: string,
    target: string | null,
    doneFlag: boolean
  ) => {
    const symsStr = JSON.stringify(syms || {});
    sessionStorage.setItem('dialogueSymptoms', symsStr);
    sessionStorage.setItem('extractedSymptoms', symsStr);
    sessionStorage.setItem('dialogueSession', JSON.stringify({
      language: lang,
      messages: msgs,
      symptoms: syms,
      state: st,
      currentQuestion: q,
      targetSymptom: target,
      isDone: doneFlag,
    }));
    dispatch(updateSymptoms(syms || {}));
  };

  // Auto-scroll chat area
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentQuestion]);

  const startFreshSession = async (speechText: string) => {
    setLoading(true);
    const recordId = (location.state as any)?.recordId || sessionStorage.getItem('record_id') || undefined;
    const msgs: Message[] = [];
    if (speechText) {
      msgs.push({
        sender: 'patient',
        text: speechText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    try {
      const res = await nlpApi.startDialogue({
        language: lang,
        initial_speech: speechText,
        record_id: recordId
      });

      const syms = res.data.detected_symptoms || {};
      const q = res.data.reply_local || res.data.reply;
      msgs.push({
        sender: 'ai',
        text: q,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      setDialogueState(res.data.state);
      setSymptoms(syms);
      setCurrentQuestion(q);
      setTargetSymptom(res.data.target_symptom);
      setIsDone(res.data.done);
      setMessages(msgs);
      persistDialogueSnapshot(msgs, syms, res.data.state, q, res.data.target_symptom, res.data.done);
    } catch (err) {
      console.error('Failed to start dynamic dialogue', err);
      showToast('Dialogue service error. Please check backend connection.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLoading(false);
    }
  };

  // Initialize or restore Dialogue cleanly (avoids StrictMode duplicate starts)
  useEffect(() => {
    const initKey = `${lang}::${navVoiceText}`;
    if (startedKeyRef.current === initKey) return;
    startedKeyRef.current = initKey;

    if (!navVoiceText) {
      const savedRaw = sessionStorage.getItem('dialogueSession');
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw);
          if (saved.language === lang && Array.isArray(saved.messages) && saved.messages.length > 0 && saved.state) {
            setMessages(saved.messages);
            setSymptoms(saved.symptoms || {});
            setDialogueState(saved.state);
            setCurrentQuestion(saved.currentQuestion || '');
            setTargetSymptom(saved.targetSymptom ?? null);
            setIsDone(!!saved.isDone);
            dispatch(updateSymptoms(saved.symptoms || {}));
            setLoading(false);
            return;
          }
        } catch { /* ignore invalid cache */ }
      }
    }

    startFreshSession(initialVoiceText);
  }, [lang, navVoiceText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submit Answer to Dialogue Engine
  const submitAnswer = async (textToSubmit: string) => {
    const text = textToSubmit.trim();
    if (!text || loading || isDone) return;

    setUserInput('');
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nextUserMsgs: Message[] = [...messages, { sender: 'patient', text, time: userTime }];
    setMessages(nextUserMsgs);
    setLoading(true);

    try {
      const res = await nlpApi.stepDialogue({
        session_id: dialogueState?.session_id,
        language: lang,
        message: text,
        state: dialogueState,
        record_id: sessionStorage.getItem('record_id') || undefined
      });

      const aiReply = res.data.reply_local || res.data.reply;
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updatedSyms = res.data.symptoms || {};
      const nextMsgs: Message[] = [...nextUserMsgs, { sender: 'ai', text: aiReply, time: aiTime }];

      setDialogueState(res.data.state);
      setSymptoms(updatedSyms);
      setCurrentQuestion(aiReply);
      setTargetSymptom(res.data.target_symptom);
      setIsDone(res.data.done);
      setMessages(nextMsgs);
      persistDialogueSnapshot(nextMsgs, updatedSyms, res.data.state, aiReply, res.data.target_symptom, res.data.done);

      if (res.data.done) {
        showToast('Clinical intake complete. Click View AI TB Risk Assessment.', 'var(--teal)', 'bi-check-circle-fill');
      }
    } catch (err) {
      console.error('Step dialogue error', err);
      showToast('Error communicating with AI engine.', 'var(--red)', 'bi-exclamation-triangle');
    } finally {
      setLoading(false);
    }
  };

  const handleRestartDialogue = () => {
    sessionStorage.removeItem('dialogueSession');
    sessionStorage.removeItem('dialogueSymptoms');
    sessionStorage.removeItem('extractedSymptoms');
    sessionStorage.removeItem('voiceCaptureText');
    sessionStorage.removeItem('record_id');
    dispatch(resetTriage());
    setIsDone(false);
    setMessages([]);
    setSymptoms({});
    startFreshSession('');
  };

  // Web Speech API Voice Input
  const toggleSpeechRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      showToast('Speech recognition not supported in this browser.', 'var(--red)', 'bi-mic-mute');
      return;
    }

    if (recording && recogRef.current) {
      recogRef.current.stop();
      setRecording(false);
      return;
    }

    const recog = new SR();
    recog.lang = LANG_BCP47[lang] || 'en-IN';
    recog.continuous = false;
    recog.interimResults = false;

    recog.onstart = () => setRecording(true);
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setRecording(false);
      if (transcript) submitAnswer(transcript);
    };
    recog.onerror = () => {
      setRecording(false);
      showToast('Could not recognize voice. Please type or click an option.', 'var(--amber)', 'bi-mic-mute');
    };
    recog.onend = () => setRecording(false);

    recogRef.current = recog;
    try {
      recog.start();
    } catch {
      setRecording(false);
    }
  };

  const handleProceedToPrediction = () => {
    if (Object.keys(symptoms).length === 0) {
      showToast('Please answer at least one symptom question or type your symptoms first.', 'var(--amber)', 'bi-info-circle');
      return;
    }
    const symsStr = JSON.stringify(symptoms);
    sessionStorage.setItem('dialogueSymptoms', symsStr);
    sessionStorage.setItem('extractedSymptoms', symsStr);
    dispatch(updateSymptoms(symptoms));
    navigate('/patient/prediction', {
      state: {
        symptoms,
        language: lang,
        recordId: sessionStorage.getItem('record_id') || undefined,
      },
    });
  };

  return (
    <RoleLayout activeNav="dialogue" pageTitle="Dynamic AI Intake">
      <div className="dash-container" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Top Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              Dynamic Clinical Dialogue
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Intelligent follow-up questions tailored to your reported symptoms.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--teal-a)',
                color: 'var(--teal)',
                border: '1px solid rgba(0,232,181,0.3)'
              }}
            >
              Language: {lang === 'Telugu' ? 'తెలుగు (Telugu)' : lang === 'Hindi' ? 'हिन्दी (Hindi)' : 'English'}
            </span>
            <button
              className="vc-btn vc-btn-ghost vc-btn-sm"
              onClick={handleRestartDialogue}
              disabled={loading}
              title="Reset dialogue session"
            >
              <i className="bi-arrow-clockwise" /> Restart
            </button>
            <button
              className="vc-btn vc-btn-ghost vc-btn-sm"
              onClick={() => navigate('/patient/language')}
            >
              Change Language
            </button>
          </div>
        </div>

        {/* ── 2-Column Layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left Column: Extracted Symptoms State */}
          <div className="dash-panel" style={{ padding: 18, position: 'sticky', top: 80 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi-clipboard2-pulse-fill" style={{ color: 'var(--teal)' }} />
              <span>Extracted Symptoms ({Object.keys(symptoms).length} / {Object.keys(SYMPTOM_LABELS).length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
              {Object.keys(SYMPTOM_LABELS).map(key => {
                const label = SYMPTOM_LABELS[key][lang === 'Telugu' ? 'te' : lang === 'Hindi' ? 'hi' : 'en'] || SYMPTOM_LABELS[key].en;
                const val = symptoms[key];

                let statusBadge = (
                  <span style={{ fontSize: 10, color: 'var(--text4)', background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>
                    Not Mentioned
                  </span>
                );

                if (key === 'cough_weeks') {
                  if (typeof val === 'number') {
                    statusBadge = (
                      <span style={{ fontSize: 11, fontWeight: 700, color: val >= 2 ? 'var(--red)' : 'var(--teal)', background: val >= 2 ? 'rgba(239,68,68,0.12)' : 'rgba(0,232,181,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                        {val === 0 ? 'No Cough (0w)' : `${val} Weeks`}
                      </span>
                    );
                  } else if (val === 'mentioned_unknown_duration') {
                    statusBadge = (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', background: 'rgba(247,187,74,0.12)', padding: '2px 6px', borderRadius: 4 }}>
                        Duration Needed
                      </span>
                    );
                  }
                } else if (val === true) {
                  statusBadge = (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                      ✓ Present
                    </span>
                  );
                } else if (val === false) {
                  statusBadge = (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'rgba(0,232,181,0.12)', padding: '2px 8px', borderRadius: 4 }}>
                      ✗ Denied (Absent)
                    </span>
                  );
                }

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: val !== undefined ? 'var(--bg3)' : 'transparent',
                      border: val !== undefined ? '1px solid var(--border)' : '1px dashed var(--border)'
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: val !== undefined ? 'var(--text)' : 'var(--text4)', fontWeight: val !== undefined ? 600 : 400 }}>
                      {label}
                    </span>
                    {statusBadge}
                  </div>
                );
              })}
            </div>

            {/* Quick Completion Button */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button
                className="vc-btn vc-btn-teal"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                onClick={handleProceedToPrediction}
              >
                <i className="bi-cpu" /> Proceed to Assessment
              </button>
            </div>
          </div>

          {/* Right Column: Conversational Dialogue Area */}
          <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column', height: '70vh', padding: 0, overflow: 'hidden' }}>
            {/* Messages Feed */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.sender === 'ai' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: m.sender === 'ai' ? 'flex-start' : 'flex-end'
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                    {m.sender === 'ai' ? (
                      <><i className="bi-robot" style={{ color: 'var(--teal)' }} /> AI Clinical Assistant</>
                    ) : (
                      <><i className="bi-person-fill" style={{ color: 'var(--blue)' }} /> You</>
                    )}
                    <span>· {m.time}</span>
                  </div>
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      fontSize: 14,
                      lineHeight: 1.5,
                      background: m.sender === 'ai' ? 'var(--bg3)' : 'linear-gradient(135deg, var(--teal), var(--blue))',
                      color: m.sender === 'ai' ? 'var(--text)' : '#fff',
                      border: m.sender === 'ai' ? '1px solid var(--border)' : 'none',
                      borderTopLeftRadius: m.sender === 'ai' ? 2 : 12,
                      borderTopRightRadius: m.sender === 'patient' ? 2 : 12,
                      boxShadow: m.sender === 'patient' ? '0 4px 12px rgba(0,232,181,0.2)' : 'none'
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text4)', fontSize: 13 }}>
                  <i className="bi-arrow-repeat" style={{ animation: 'vcSpin .7s linear infinite' }} />
                  <span>Evaluating symptoms…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom Interaction Area */}
            <div style={{ padding: '16px 20px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
              {isDone ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)', marginBottom: 8 }}>
                    ✓ Clinical Information Intake Complete!
                  </div>
                  <button
                    className="vc-btn vc-btn-teal"
                    style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700 }}
                    onClick={handleProceedToPrediction}
                  >
                    <i className="bi-cpu-fill" /> View AI TB Risk Assessment
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Quick Options Chips — contextual for cough_weeks vs Yes/No questions */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text4)' }}>Quick Answer:</span>

                    {targetSymptom === 'cough_weeks' ? (
                      lang === 'Telugu' ? (
                        <>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('దగ్గు లేదు')} disabled={loading}>✗ దగ్గు లేదు (No Cough)</button>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('1 వారం')} disabled={loading}>1 వారం</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('2 వారాలు')} disabled={loading}>2 వారాలు</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('3 వారాలు')} disabled={loading}>3 వారాలు</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('1 నెల')} disabled={loading}>1 నెల+</button>
                        </>
                      ) : lang === 'Hindi' ? (
                        <>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('खांसी नहीं है')} disabled={loading}>✗ खांसी नहीं है (No Cough)</button>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('1 हफ्ता')} disabled={loading}>1 हफ्ता</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('2 हफ्ते')} disabled={loading}>2 हफ्ते</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('3 हफ्ते')} disabled={loading}>3 हफ्ते</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('1 महीना')} disabled={loading}>1 महीना+</button>
                        </>
                      ) : (
                        <>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('No cough')} disabled={loading}>✗ No Cough</button>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('several days')} disabled={loading}>&lt; 1 week</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('1 week')} disabled={loading}>1 week</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('2 weeks')} disabled={loading}>2 weeks</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('3 weeks')} disabled={loading}>3 weeks</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('1 month')} disabled={loading}>1 month+</button>
                        </>
                      )
                    ) : targetSymptom === 'cough_phlegm' ? (
                      lang === 'Telugu' ? (
                        <>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('Avunu (అవును)')} disabled={loading}>✓ అవును (కఫం ఉంది)</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('Ledhu (లేదు)')} disabled={loading}>✗ లేదు (పొడి దగ్గు)</button>
                        </>
                      ) : lang === 'Hindi' ? (
                        <>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('हाँ (Yes)')} disabled={loading}>✓ हाँ (बलगम है)</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('नहीं (No)')} disabled={loading}>✗ नहीं (सूखी खांसी)</button>
                        </>
                      ) : (
                        <>
                          <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('Yes (Phlegm)')} disabled={loading}>✓ Yes (Phlegm)</button>
                          <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('No (Dry Cough)')} disabled={loading}>✗ No (Dry Cough)</button>
                        </>
                      )
                    ) : lang === 'Telugu' ? (
                      <>
                        <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('Avunu (అవును)')} disabled={loading}>✓ Avunu (అవును)</button>
                        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('Ledhu (లేదు)')} disabled={loading}>✗ Ledhu (లేదు)</button>
                      </>
                    ) : lang === 'Hindi' ? (
                      <>
                        <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('हाँ (Yes)')} disabled={loading}>✓ हाँ (Yes)</button>
                        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('नहीं (No)')} disabled={loading}>✗ नहीं (No)</button>
                      </>
                    ) : (
                      <>
                        <button className="vc-btn vc-btn-teal vc-btn-sm" onClick={() => submitAnswer('Yes')} disabled={loading}>✓ Yes</button>
                        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={() => submitAnswer('No')} disabled={loading}>✗ No</button>
                      </>
                    )}
                  </div>

                  {/* Input row: Mic + Text input + Send */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="vc-btn"
                      onClick={toggleSpeechRecognition}
                      title={recording ? 'Stop voice recording' : 'Speak your answer in ' + lang}
                      style={{
                        padding: '10px 14px',
                        background: recording ? 'var(--red)' : 'var(--bg3)',
                        borderColor: recording ? 'var(--red)' : 'var(--border)',
                        color: recording ? '#fff' : 'var(--teal)'
                      }}
                    >
                      <i className={recording ? 'bi-stop-fill' : 'bi-mic-fill'} style={{ fontSize: 16 }} />
                    </button>

                    <input
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitAnswer(userInput)}
                      placeholder={
                        recording
                          ? 'Listening… speak now'
                          : lang === 'Telugu'
                          ? 'మీ సమాధానం టైప్ చేయండి లేదా మాట్లాడండి…'
                          : lang === 'Hindi'
                          ? 'अपना उत्तर लिखें या बोलें…'
                          : 'Type or speak your answer…'
                      }
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: 14
                      }}
                    />

                    <button
                      className="vc-btn vc-btn-teal"
                      onClick={() => submitAnswer(userInput)}
                      disabled={loading || !userInput.trim()}
                      style={{ padding: '10px 18px' }}
                    >
                      <i className="bi-send-fill" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  );
}
