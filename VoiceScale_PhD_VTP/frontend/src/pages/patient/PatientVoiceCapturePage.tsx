import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../AppLayout';
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

/* ─── language meta ─────────────────────────────────────────────── */
const LANG_META: Record<string, { native: string; bcp47: string; flag: string; hint: string }> = {
  Telugu:    { native: 'తెలుగు',   bcp47: 'te-IN', flag: '🇮🇳', hint: 'మీరు ఏమైనా చెప్పండి…'        },
  Tamil:     { native: 'தமிழ்',   bcp47: 'ta-IN', flag: '🇮🇳', hint: 'ஏதாவது சொல்லுங்கள்…'          },
  Hindi:     { native: 'हिंदी',    bcp47: 'hi-IN', flag: '🇮🇳', hint: 'कुछ भी बोलें…'                },
  Kannada:   { native: 'ಕನ್ನಡ',   bcp47: 'kn-IN', flag: '🇮🇳', hint: 'ಏನಾದರೂ ಹೇಳಿ…'                 },
  Malayalam: { native: 'മലയാളം', bcp47: 'ml-IN', flag: '🇮🇳', hint: 'എന്തെങ്കിലും പറയൂ…'            },
  Marathi:   { native: 'मराठी',   bcp47: 'mr-IN', flag: '🇮🇳', hint: 'काहीतरी बोला…'                 },
  Bengali:   { native: 'বাংলা',   bcp47: 'bn-IN', flag: '🇮🇳', hint: 'কিছু বলুন…'                    },
  English:   { native: 'English', bcp47: 'en-IN', flag: '🇬🇧', hint: 'Say anything…'                  },
};

/* ─── waveform bars ─────────────────────────────────────────────── */
const BAR_COUNT = 28;

export function PatientVoiceCapturePage() {
  const navigate = useNavigate();
  const location  = useLocation();

  // Language can come via router state or sessionStorage
  const langName: string =
    (location.state as any)?.language ||
    sessionStorage.getItem('selectedLanguage') ||
    'English';

  const meta = LANG_META[langName] ?? LANG_META['English'];

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
      console.log('Speech recognition started');
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
      console.log('Speech recognition ended, recording:', recording);
      // Speech recognition can end naturally, don't stop everything
      // Only clean up if user explicitly stopped recording
      if (recording && recogRef.current) {
        // Restart if it ended unexpectedly but user still wants to record
        setTimeout(() => {
          if (recording) {
            try {
              console.log('Restarting speech recognition...');
              recogRef.current?.start();
            } catch (e) {
              console.error('Failed to restart speech recognition:', e);
            }
          }
        }, 100);
      }
    };

    recogRef.current = recog;
    try { recog.start(); } catch { setPermErr('Could not start microphone.'); }
  }, [meta.bcp47, stopAll]);

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
    try {
      const res = await patientApi.submitVoiceIntake({ language: langName, voice_transcript: text });
      sessionStorage.setItem('voiceCaptureText', text);
      sessionStorage.setItem('record_id', res.data.record_id);
    } catch {
      // Offline / not logged in — still allow continuing
      sessionStorage.setItem('voiceCaptureText', text);
    } finally {
      setSaving(false);
    }
    navigate('/patient/questions', { state: { voiceText: text, language: langName } });
  };

  /* ── timer format ─────────────────────────────────────────────── */
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const displayText = transcript + interimText;
  const canContinue = displayText.trim().length > 0 && !recording && !saving;

  return (
    <AppLayout>
      <div className="vc-page" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="vc-page-header" style={{ paddingLeft: 0, paddingRight: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="vc-ph-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div>
              <div className="vc-ph-title">Voice Check-in</div>
              <div className="vc-ph-sub">Speak in your language · {meta.flag} {langName}</div>
            </div>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: 'var(--teal)',
              background: 'var(--teal-a)', border: '1px solid rgba(0,232,181,.25)',
              padding: '4px 10px', borderRadius: 20
            }}>
              <span style={{ fontSize: 15 }}>{meta.flag}</span>
              {meta.native}
            </span>
          </div>
        </div>

        {/* ── Unsupported / Permission Error ──────────────────────── */}
        {(!supported || permErr) && (
          <div className="vc-card" style={{
            borderColor: 'var(--red)', background: 'var(--red-a)',
            display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, width: '100%', maxWidth: '700px'
          }}>
            <i className="bi-exclamation-triangle-fill" style={{ color: 'var(--red)', fontSize: 18, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
              {!supported
                ? 'Voice input is not supported in this browser. Please use Chrome or Edge.'
                : permErr}
            </div>
          </div>
        )}

        {/* ── Mic Area ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '28px 0' }}>

          {/* Timer */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 700,
            letterSpacing: -1, color: recording ? 'var(--teal)' : 'var(--text4)',
            transition: 'color .3s', minHeight: 40, lineHeight: 1
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
              <div style={{ position:'absolute', width:100, height:100, borderRadius:'50%', border:'1.5px solid rgba(0,232,181,.4)', animation:'vcPulse1 1.4s ease-out infinite' }} />
              <div style={{ position:'absolute', width:120, height:120, borderRadius:'50%', border:'1px solid rgba(0,232,181,.2)', animation:'vcPulse1 1.4s ease-out infinite .4s' }} />
            </>}
            <button
              onClick={handleToggle}
              disabled={!supported && !permErr}
              style={{
                width: 72, height: 72, borderRadius: '50%', border: 'none',
                cursor: 'pointer', position: 'relative', zIndex: 1,
                background: recording
                  ? 'var(--red)'
                  : 'linear-gradient(135deg, var(--teal), var(--blue))',
                boxShadow: recording
                  ? '0 0 0 4px rgba(239,68,68,.2), 0 8px 24px rgba(239,68,68,.3)'
                  : '0 8px 28px rgba(0,232,181,.3)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, transition: 'all .25s ease',
              }}
            >
              <i className={recording ? 'bi-stop-fill' : 'bi-mic-fill'} />
            </button>
          </div>

          {/* Status label */}
          <div style={{ fontSize: 13, color: recording ? 'var(--teal)' : 'var(--text4)', textAlign: 'center', minHeight: 20 }}>
            {recording
              ? `Listening in ${langName}… tap stop when done`
              : displayText ? 'Recording complete — review below' : meta.hint}
          </div>
        </div>

        {/* ── Transcript Box ───────────────────────────────────────── */}
        <div className="vc-card" style={{ marginBottom: 14, minHeight: 100, width: '100%', maxWidth: '700px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: .5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="bi-chat-square-text" />
              What you said
            </div>
            {displayText && !recording && (
              <button onClick={handleClear} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text4)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px', borderRadius: 6, transition: 'color .15s'
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
              color: 'var(--text1)', wordBreak: 'break-word'
            }}>
              {transcript}
              {interimText && (
                <span style={{ color: 'var(--text4)', fontStyle: 'italic' }}>{interimText}</span>
              )}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--text4)' }}>
              <i className="bi-mic" style={{ fontSize: 24, opacity: .4 }} />
              <span style={{ fontSize: 13 }}>Your speech will appear here</span>
            </div>
          )}
        </div>

        {/* ── Action Buttons ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          <button
            className="vc-btn vc-btn-ghost vc-btn-sm"
            onClick={() => navigate(-1)}
            style={{ flexShrink: 0 }}
          >
            <i className="bi-chevron-left" /> Back
          </button>

          <button
            className={`vc-btn vc-btn-sm ${canContinue ? 'vc-btn-teal' : 'vc-btn-ghost'}`}
            disabled={!canContinue}
            onClick={handleContinue}
            style={{ flex: 1 }}
          >
            <i className={saving ? 'bi-hourglass-split' : 'bi-arrow-right'} />
            {saving ? 'Saving…' : 'Continue to Questions'}
          </button>
        </div>

        {/* ── Tip ─────────────────────────────────────────────────── */}
        <p style={{ fontSize: 11, color: 'var(--text4)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.6 }}>
          <i className="bi-info-circle" style={{ marginRight: 4 }} />
          Speak clearly. You can re-record by tapping the mic again.
        </p>
      </div>

      {/* Pulse keyframes injected inline so no extra CSS file needed */}
      <style>{`
        @keyframes vcPulse1 {
          0%   { transform: scale(1);   opacity: .7; }
          100% { transform: scale(1.6); opacity: 0;  }
        }
      `}</style>
    </AppLayout>
  );
}
