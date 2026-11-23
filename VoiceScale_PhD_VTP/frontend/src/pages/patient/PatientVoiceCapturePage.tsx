import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoleLayout from '../../layouts/RoleLayout';
import { patientApi } from '../../api/client';

// ─── Speech Recognition Types ───────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: () => void;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

/* ─── language meta: Telugu, Hindi, English ───────────────────────── */
const LANG_META: Record<string, { native: string; bcp47: string; flag: string; hint: string }> = {
  Telugu:  { native: 'తెలుగు',  bcp47: 'te-IN', flag: '🇮🇳', hint: 'మీరు ఏమైనా చెప్పండి… (ఉదా: దగ్గు, జ్వరం, రాత్రి చెమటలు)' },
  Hindi:   { native: 'हिंदी',   bcp47: 'hi-IN', flag: '🇮🇳', hint: 'अपनी परेशानी बताएं… (जैसे: खांसी, बुखार, सीने में दर्द)' },
  English: { native: 'English', bcp47: 'en-IN', flag: '🇬🇧', hint: 'Say anything about your symptoms… (e.g. cough, fever, chest pain)' },
};

/* ─── waveform bars ─────────────────────────────────────────────── */
const BAR_COUNT = 28;

export function PatientVoiceCapturePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const langName: string =
    (location.state as any)?.language ||
    sessionStorage.getItem('selectedLanguage') ||
    'Telugu';

  const meta = LANG_META[langName] ?? LANG_META['Telugu'];

  /* ── state ────────────────────────────────────────────────────── */
  const [recording,    setRecording]    = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [interimText,  setInterimText]  = useState('');
  const [barHeights,   setBarHeights]   = useState<number[]>(Array(BAR_COUNT).fill(4));
  const [seconds,      setSeconds]      = useState(0);
  const [supported,    setSupported]    = useState(true);
  const [permErr,      setPermErr]      = useState('');
  const [saving,       setSaving]       = useState(false);

  const recogRef  = useRef<SpeechRecognition | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalRef  = useRef('');

  /* ── check browser support ────────────────────────────────────── */
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => stopAll();
  }, []);

  /* ── helpers ──────────────────────────────────────────────────── */
  const stopAll = useCallback(() => {
    recogRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (animRef.current)  clearInterval(animRef.current);
    setBarHeights(Array(BAR_COUNT).fill(4));
    setRecording(false);
  }, []);

  const startWaveAnim = () => {
    animRef.current = setInterval(() => {
      setBarHeights(prev =>
        prev.map(() => Math.floor(Math.random() * 28) + 4)
      );
    }, 120);
  };

  /* ── start recording ──────────────────────────────────────────── */
  const startRecording = useCallback(() => {
    setPermErr('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const recog: SpeechRecognition = new SR();
    recog.lang            = meta.bcp47;
    recog.continuous      = true;
    recog.interimResults  = true;

    recog.onstart = () => {
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      startWaveAnim();
    };

    recog.onresult = (e: any) => {
      let interim = '';
      let final   = finalRef.current;
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      finalRef.current = final;
      setTranscript(final);
      setInterimText(interim);
    };

    recog.onerror = (e: any) => {
      if (e.error === 'not-allowed') setPermErr('Microphone access denied. Please allow it in your browser settings.');
      stopAll();
    };

    recog.onend = () => {
      if (recording && recogRef.current) {
        setTimeout(() => {
          if (recording) {
            try {
              recogRef.current?.start();
            } catch {
              // ignore
            }
          }
        }, 100);
      }
    };

    recogRef.current = recog;
    try { recog.start(); } catch { setPermErr('Could not start microphone.'); }
  }, [meta.bcp47, stopAll, recording]);

  /* ── stop recording ───────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    recogRef.current?.stop();
    stopAll();
    setInterimText('');
  }, [stopAll]);

  const handleToggle = () => recording ? stopRecording() : startRecording();

  const handleClear = () => {
    finalRef.current = '';
    setTranscript('');
    setInterimText('');
    setSeconds(0);
  };

  const handleContinue = async () => {
    const text = (transcript + interimText).trim();
    if (!text) return;
    setSaving(true);
    let recordId = 'REC-' + Date.now();
    try {
      const res = await patientApi.submitVoiceIntake({ language: langName, voice_transcript: text });
      if (res.data?.record_id) recordId = res.data.record_id;
      sessionStorage.setItem('voiceCaptureText', text);
      sessionStorage.setItem('record_id', recordId);
    } catch {
      sessionStorage.setItem('voiceCaptureText', text);
      sessionStorage.setItem('record_id', recordId);
    } finally {
      setSaving(false);
    }
    // Navigate straight to dynamic conversational dialogue pipeline
    navigate('/patient/dialogue', { state: { voiceText: text, language: langName, recordId } });
  };

  /* ── timer format ─────────────────────────────────────────────── */
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const displayText = transcript + interimText;
  const canContinue = displayText.trim().length > 0 && !recording && !saving;

  return (
    <RoleLayout activeNav="screening" pageTitle="Voice Check-in">
      <div className="vc-page" style={{ maxWidth: 840, margin: '0 auto', padding: '16px 16px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="vc-page-header" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="vc-ph-title" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text1)' }}>Voice Symptom Intake</div>
          <div className="vc-ph-sub" style={{ fontSize: 14, color: 'var(--text3)' }}>
            Speak naturally about your cough, fever, duration, or general health
          </div>
          <div style={{ marginTop: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: 'var(--teal)',
              background: 'var(--teal-a)', border: '1px solid rgba(0,232,181,.25)',
              padding: '4px 14px', borderRadius: 20
            }}>
              <span>{meta.flag}</span>
              {langName} ({meta.native})
            </span>
          </div>
        </div>

        {/* ── Unsupported / Permission Error ──────────────────────── */}
        {(!supported || permErr) && (
          <div className="vc-card" style={{
            borderColor: 'var(--red)', background: 'var(--red-a)',
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, width: '100%', maxWidth: '640px'
          }}>
            <i className="bi-exclamation-triangle-fill" style={{ color: 'var(--red)', fontSize: 18, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              {!supported
                ? 'Voice input is not supported in this browser. Please use Chrome or Edge.'
                : permErr}
            </div>
          </div>
        )}

        {/* ── Mic & Waveform Area ─────────────────────────────────── */}
        <div style={{
          width: '100%', maxWidth: 640,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '32px 24px', display: 'flex',
          flexDirection: 'column', alignItems: 'center', gap: 20,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
        }}>

          {/* Timer */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 700,
            letterSpacing: -1, color: recording ? 'var(--teal)' : 'var(--text4)',
            transition: 'color .3s', minHeight: 44, lineHeight: 1
          }}>
            {recording ? fmt(seconds) : '00:00'}
          </div>

          {/* Waveform */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 44 }}>
            {barHeights.map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                height: recording ? h : 4,
                background: recording ? 'var(--teal)' : 'var(--border)',
                opacity: recording ? 0.85 : 0.4,
                transition: recording ? 'height .12s ease' : 'height .4s ease',
                transitionDelay: recording ? `${i * 10}ms` : '0ms',
              }} />
            ))}
          </div>

          {/* Big Mic Button */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {recording && <>
              <div style={{ position:'absolute', width:100, height:100, borderRadius:'50%', border:'2px solid rgba(0,232,181,.5)', animation:'vcPulse1 1.4s ease-out infinite' }} />
              <div style={{ position:'absolute', width:130, height:130, borderRadius:'50%', border:'1px solid rgba(0,232,181,.25)', animation:'vcPulse1 1.4s ease-out infinite .4s' }} />
            </>}
            <button
              onClick={handleToggle}
              disabled={!supported && !permErr}
              style={{
                width: 76, height: 76, borderRadius: '50%', border: 'none',
                cursor: 'pointer', position: 'relative', zIndex: 1,
                background: recording
                  ? '#ef4444'
                  : 'linear-gradient(135deg, #0d9488, #2563eb)',
                boxShadow: recording
                  ? '0 0 0 6px rgba(239,68,68,.25), 0 10px 28px rgba(239,68,68,.4)'
                  : '0 8px 28px rgba(13,148,136,.35)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, transition: 'all .25s ease',
              }}
              title={recording ? "Tap to stop recording" : "Tap to speak"}
            >
              <i className={recording ? 'bi-stop-fill' : 'bi-mic-fill'} />
            </button>
          </div>

          {/* Status label */}
          <div style={{ fontSize: 13, color: recording ? 'var(--teal)' : 'var(--text3)', textAlign: 'center', minHeight: 22 }}>
            {recording
              ? `Listening in ${langName}… Tap stop when finished`
              : displayText ? 'Recording complete — review what was detected below' : meta.hint}
          </div>
        </div>

        {/* ── Transcript Box ───────────────────────────────────────── */}
        <div style={{
          width: '100%', maxWidth: 640, marginTop: 20,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '20px', minHeight: 110,
          boxShadow: '0 4px 18px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi-chat-square-text-fill" style={{ color: 'var(--teal)' }} />
              Recognized Speech
            </div>
            {displayText && !recording && (
              <button onClick={handleClear} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text4)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 6
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text4)')}
              >
                <i className="bi-trash3" /> Clear
              </button>
            )}
          </div>

          {displayText ? (
            <p style={{
              margin: 0, fontSize: 15, lineHeight: 1.7,
              color: 'var(--text1)', wordBreak: 'break-word', fontWeight: 500
            }}>
              {transcript}
              {interimText && (
                <span style={{ color: 'var(--teal)', fontStyle: 'italic', opacity: 0.8 }}>{interimText}</span>
              )}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0', color: 'var(--text4)' }}>
              <i className="bi-mic" style={{ fontSize: 24, opacity: .4 }} />
              <span style={{ fontSize: 13 }}>Tap the microphone above and describe your symptoms</span>
            </div>
          )}
        </div>

        {/* ── Action Buttons ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24, width: '100%', maxWidth: 640 }}>
          <button
            className="vc-btn vc-btn-ghost"
            onClick={() => navigate('/patient/language')}
            style={{ padding: '12px 20px', borderRadius: 10, cursor: 'pointer' }}
          >
            <i className="bi-chevron-left" /> Change Language
          </button>

          <button
            className="vc-btn"
            disabled={!canContinue}
            onClick={handleContinue}
            style={{
              flex: 1, padding: '12px 24px', borderRadius: 10,
              background: canContinue ? 'linear-gradient(135deg, #0d9488, #2563eb)' : 'var(--bg3)',
              color: canContinue ? '#fff' : 'var(--text4)',
              border: 'none', fontWeight: 600, fontSize: 15,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: canContinue ? '0 4px 16px rgba(13,148,136,.3)' : 'none'
            }}
          >
            <i className={saving ? 'bi-hourglass-split' : 'bi-chat-dots-fill'} />
            {saving ? 'Processing Speech…' : 'Continue to Dynamic Follow-up Questions'}
          </button>
        </div>

        {/* ── Tip ─────────────────────────────────────────────────── */}
        <p style={{ fontSize: 12, color: 'var(--text4)', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.6 }}>
          <i className="bi-lightbulb-fill" style={{ color: 'var(--amber)', marginRight: 5 }} />
          Tip: You can mention cough duration, night fever, weight changes, or chest discomfort. The AI will formulate targeted follow-ups.
        </p>
      </div>

      <style>{`
        @keyframes vcPulse1 {
          0%   { transform: scale(1);   opacity: .8; }
          100% { transform: scale(1.6); opacity: 0;  }
        }
      `}</style>
    </RoleLayout>
  );
}
