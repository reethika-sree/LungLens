/**
 * PatientChatPage — ChatGPT-style AI triage interface
 * ─────────────────────────────────────────────────────
 * • Real AI via /api/v1/chat/triage  (LangGraph agent on backend)
 * • Voice INPUT: English → Web Speech API STT
 *                Indic   → record blob → Colab Whisper (same voice pipeline)
 * • Voice OUTPUT: English → Web Speech API TTS
 *                 Indic   → /api/v1/voice/tts → Colab gTTS → base64 MP3
 * • Every AI question is spoken aloud in the patient's language automatically
 * • Mic button in the input bar lets the patient speak their answer anytime
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../components/ToastProvider';
import './PatientPages.css';

// ─── Types ───────────────────────────────────────────────────────────────────

// Speech Recognition API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: () => void;
  }
  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    transcript: string;
    confidence: number;
  }
}

interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;           // display text (may be local language)
  englishText?: string;   // underlying English for backend
  audioB64?: string;      // gTTS MP3 for this message
  timestamp: Date;
}

interface TriageState {
  symptoms: Record<string, string>;
  questionIndex: number;
  done: boolean;
  riskScore?: number;
  priority?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ENGLISH_LANGS = new Set(['English']);

// Whether to use Web Speech API (English) vs ngrok Colab (Indic)
const useWebSpeech = (lang: string) => ENGLISH_LANGS.has(lang);

// ─── Utility ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PatientChatPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [triage, setTriage] = useState<TriageState>({
    symptoms: {},
    questionIndex: 0,
    done: false,
  });

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string>(uid());

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Start session with greeting ──────────────────────────────────────────────
  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS: speak AI message ────────────────────────────────────────────────────

  const speakText = useCallback(async (text: string, audioB64?: string) => {
    // Stop any current speech
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();

    if (!text) return;

    setIsSpeaking(true);

    try {
      if (useWebSpeech(language)) {
        // English — Web Speech API TTS
        const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else if (audioB64) {
        // Indic — play pre-generated gTTS audio from Colab
        const audio = new Audio(`data:audio/mp3;base64,${audioB64}`);
        currentAudioRef.current = audio;
        audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
        audio.onerror = () => { setIsSpeaking(false); currentAudioRef.current = null; };
        await audio.play();
      } else {
        // Indic — request TTS from backend → Colab gTTS
        const resp = await fetch('/api/v1/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.audio_b64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
            currentAudioRef.current = audio;
            audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; };
            audio.onerror = () => { setIsSpeaking(false); currentAudioRef.current = null; };
            await audio.play();
            return;
          }
        }
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  }, [language]);

  // ── Add message helper ───────────────────────────────────────────────────────

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = { ...msg, id: uid(), timestamp: new Date() };
    setMessages(prev => [...prev, full]);
    return full;
  }, []);

  // ── Start session — call backend for greeting ────────────────────────────────

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/v1/chat/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          language,
          message: '__START__',
          triage_state: { symptoms: {}, questionIndex: 0, done: false },
        }),
      });

      if (!resp.ok) throw new Error('Backend unavailable');
      const data = await resp.json();

      const msg = addMessage({
        role: 'ai',
        text: data.reply_local || data.reply,
        englishText: data.reply,
        audioB64: data.audio_b64,
      });

      // Auto-speak the greeting
      setTimeout(() => speakText(msg.text, msg.audioB64), 400);

      if (data.triage_state) setTriage(data.triage_state);
    } catch {
      // Fallback greeting if backend is down
      const greetings: Record<string, string> = {
        Telugu: 'నమస్కారం! నేను VoiceCare PHC AI. మీకు ఎంత కాలం నుండి దగ్గు వస్తోంది?',
        Hindi: 'नमस्ते! मैं VoiceCare PHC AI हूं। आपको कितने समय से खांसी है?',
        Tamil: 'வணக்கம்! நான் VoiceCare PHC AI. உங்களுக்கு எவ்வளவு காலமாக இருமல் உள்ளது?',
        Kannada: 'ನಮಸ್ಕಾರ! ನಾನು VoiceCare PHC AI. ನಿಮಗೆ ಎಷ್ಟು ಕಾಲದಿಂದ ಕೆಮ್ಮು ಬರುತ್ತಿದೆ?',
        English: 'Hello! I\'m VoiceCare PHC AI. How long have you had this cough?',
      };
      const text = greetings[language] || greetings['English'];
      const msg = addMessage({ role: 'ai', text });
      setTimeout(() => speakText(msg.text), 400);
    } finally {
      setIsLoading(false);
    }
  }, [language, addMessage, speakText]);

  // ── Send user message to AI ──────────────────────────────────────────────────

  const sendMessage = useCallback(async (userText: string, englishText?: string) => {
    if (!userText.trim() || isLoading) return;

    // Add user message
    addMessage({ role: 'user', text: userText, englishText });
    setInputText('');
    setIsLoading(true);

    try {
      const resp = await fetch('/api/v1/chat/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          language,
          message: englishText || userText,
          message_local: userText,
          triage_state: triage,
        }),
      });

      if (!resp.ok) throw new Error('Backend error');
      const data = await resp.json();

      const aiMsg = addMessage({
        role: 'ai',
        text: data.reply_local || data.reply,
        englishText: data.reply,
        audioB64: data.audio_b64,
      });

      // Auto-speak AI reply
      speakText(aiMsg.text, aiMsg.audioB64);

      if (data.triage_state) setTriage(data.triage_state);

      // If triage complete, auto-navigate after 3s
      if (data.triage_state?.done) {
        setTimeout(() => {
          navigate('/patient/confirm', {
            state: { triageResult: data.triage_state, chatMessages: messages },
          });
        }, 3000);
      }
    } catch {
      addMessage({
        role: 'ai',
        text: language === 'English'
          ? 'Sorry, I had a connection issue. Please try again.'
          : 'క్షమించండి, సమస్య వచ్చింది. మళ్ళీ ప్రయత్నించండి.',
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [language, triage, isLoading, addMessage, speakText, navigate, messages]);

  // ── Voice INPUT: English — Web Speech API ────────────────────────────────────

  const startWebSpeechListening = useCallback(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      showToast('Speech recognition not supported in this browser', 'var(--red)', 'bi-exclamation-circle');
      return;
    }

    const sr = new SpeechRecognitionClass() as SpeechRecognition;
    sr.lang = 'en-US';
    sr.interimResults = true;
    sr.maxAlternatives = 1;
    speechRecognitionRef.current = sr;

    sr.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInputText(transcript);
    };

    sr.onend = () => {
      setIsListening(false);
      // Auto-send if we got something
      if (inputRef.current?.value.trim()) {
        sendMessage(inputRef.current.value.trim());
      }
    };

    sr.onerror = () => setIsListening(false);

    sr.start();
    setIsListening(true);
    showToast('Listening… speak now', 'var(--teal)', 'bi-mic-fill');
  }, [sendMessage, showToast]);

  // ── Voice INPUT: Indic — record → Colab Whisper ──────────────────────────────

  const startIndicListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });

        // Send to existing /api/v1/voice/process → Colab Whisper
        const form = new FormData();
        form.append('audio_file', blob, 'answer.webm');
        form.append('language', language);

        setIsLoading(true);
        try {
          const resp = await fetch('/api/v1/voice/process', { method: 'POST', body: form });
          if (resp.ok) {
            const data = await resp.json();
            const localText = data.local_transcript || '';
            const englishText = data.english_transcript || localText;
            if (localText) {
              sendMessage(localText, englishText);
            } else {
              showToast('Could not hear clearly. Please try again.', 'var(--orange)', 'bi-exclamation-circle');
            }
          }
        } catch {
          showToast('Voice processing failed', 'var(--red)', 'bi-exclamation-triangle');
        } finally {
          setIsLoading(false);
          setIsListening(false);
        }
      };

      mr.start(250);
      setIsListening(true);
      showToast('Listening… tap mic again to stop', 'var(--teal)', 'bi-mic-fill');
    } catch {
      showToast('Microphone access denied', 'var(--red)', 'bi-mic-mute-fill');
    }
  }, [language, sendMessage, showToast]);

  const stopIndicListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Unified mic toggle ───────────────────────────────────────────────────────

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      // Stop
      if (useWebSpeech(language)) {
        speechRecognitionRef.current?.stop();
      } else {
        stopIndicListening();
      }
      setIsListening(false);
    } else {
      if (useWebSpeech(language)) {
        startWebSpeechListening();
      } else {
        startIndicListening();
      }
    }
  }, [isListening, language, startWebSpeechListening, startIndicListening, stopIndicListening]);

  // ── Stop AI speaking ─────────────────────────────────────────────────────────

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── Replay a specific message ────────────────────────────────────────────────

  const replayMessage = useCallback((msg: ChatMessage) => {
    speakText(msg.text, msg.audioB64);
  }, [speakText]);

  // ── Format time ─────────────────────────────────────────────────────────────

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Render ──────────────────────────────────────────────────────────────────

  const langFlag: Record<string, string> = {
    Telugu: 'తె', Hindi: 'हि', Tamil: 'த', Kannada: 'ಕ',
    Marathi: 'म', Bengali: 'ব', Gujarati: 'ગ', Punjabi: 'ਪ',
    Odia: 'ଓ', Malayalam: 'മ', English: 'EN',
  };

  return (
      <div className="vc-page" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div className="vc-chat-topbar">
          <div className="vc-chat-agent">
            <div className="vc-agent-avatar">
              <i className="bi-robot" />
            </div>
            <div>
              <div className="vc-agent-name">VoiceCare PHC AI</div>
              <div className="vc-agent-status">
                <span className="vc-o-dot" />
                {isLoading ? 'Thinking…' : isSpeaking ? 'Speaking…' : 'Online · TB Triage Assistant'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Language badge */}
            <div className="vc-lang-badge">
              <span className="vc-lang-badge-flag">{langFlag[language] || '🌐'}</span>
              {language}
            </div>

            {/* Stop speaking */}
            {isSpeaking && (
              <button className="vc-icon-btn vc-icon-btn-red" onClick={stopSpeaking} title="Stop speaking">
                <i className="bi-volume-mute-fill" />
              </button>
            )}

            </div>
        </div>

        {/* ── TB Risk Progress ── */}
        {triage.questionIndex > 0 && (
          <div className="vc-chat-progress">
            <div className="vc-cp-label">
              <i className="bi-lungs" />
              TB Triage: Question {triage.questionIndex} of 7
            </div>
            <div className="vc-cp-bar">
              <div
                className="vc-cp-fill"
                style={{ width: `${Math.min((triage.questionIndex / 7) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Message Area ── */}
        <div className="vc-chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`vc-cm-row ${msg.role}`}>
              {msg.role === 'ai' && (
                <div className="vc-cm-avatar ai">
                  <i className="bi-robot" style={{ fontSize: 14 }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '80%' }}>
                <div
                  className={`vc-cm-bubble ${msg.role}`}
                  dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />

                <div className={`vc-cm-meta ${msg.role}`}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {msg.role === 'ai' && (
                    <button
                      className="vc-cm-replay"
                      onClick={() => replayMessage(msg)}
                      title="Replay audio"
                    >
                      <i className="bi-volume-up-fill" />
                    </button>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="vc-cm-avatar user">
                  <i className="bi-person-fill" style={{ fontSize: 14 }} />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="vc-cm-row ai">
              <div className="vc-cm-avatar ai">
                <i className="bi-robot" style={{ fontSize: 14 }} />
              </div>
              <div className="vc-cm-bubble ai">
                <div className="typing-dots">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Input Bar ── */}
        <div className="vc-chat-inputbar">
          {/* Listening indicator */}
          {isListening && (
            <div className="vc-listening-banner">
              <div className="vc-mic-pulse" />
              <span>Listening in {language}… {useWebSpeech(language) ? '' : 'tap mic to stop'}</span>
            </div>
          )}

          <div className="vc-chat-input-row">
            {/* Mic button */}
            <button
              className={`vc-mic-toggle ${isListening ? 'active' : ''}`}
              onClick={handleMicToggle}
              title={isListening ? 'Tap to stop listening' : `Speak in ${language}`}
            >
              <i className={isListening ? 'bi-stop-fill' : 'bi-mic-fill'} />
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              className="vc-chat-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputText);
                }
              }}
              placeholder={
                isListening
                  ? `Listening in ${language}…`
                  : language === 'English'
                  ? 'Type your answer…'
                  : `${language}లో టైప్ చేయండి లేదా మాట్లాడండి…`
              }
              disabled={isLoading}
            />

            {/* Send button */}
            <button
              className="vc-send-btn"
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              {triage.done ? (
                <><i className="bi-check2-circle" /> View Summary</>
              ) : (
                <i className="bi-send-fill" />
              )}
            </button>
          </div>

          {/* Quick action chips */}
          <div className="vc-quick-chips">
            {language !== 'English' && (
              <button className="vc-chip" onClick={() => sendMessage('అవును', 'Yes')}>
                ✓ {language === 'Telugu' ? 'అవును' : language === 'Hindi' ? 'हाँ' : 'Yes'}
              </button>
            )}
            {language !== 'English' && (
              <button className="vc-chip" onClick={() => sendMessage('లేదు', 'No')}>
                ✗ {language === 'Telugu' ? 'లేదు' : language === 'Hindi' ? 'नहीं' : 'No'}
              </button>
            )}
            <button className="vc-chip" onClick={() => sendMessage('తెలియదు', "I don't know")}>
              ? {language === 'Telugu' ? 'తెలియదు' : language === 'Hindi' ? 'पता नहीं' : "Don't know"}
            </button>
            <button
              className="vc-chip vc-chip-skip"
              onClick={() => navigate('/patient/confirm', { state: { chatMessages: messages } })}
            >
              <i className="bi-skip-forward-fill" /> Skip to summary
            </button>
          </div>
        </div>

      </div>
  );
}
