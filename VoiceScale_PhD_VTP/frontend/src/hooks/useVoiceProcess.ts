/**
 * useVoiceProcess.ts
 * ------------------
 * Drop this file at:  frontend/src/hooks/useVoiceProcess.ts
 *
 * Wires the MediaRecorder → FastAPI /api/v1/voice/process → Colab GPU pipeline.
 */

import { useState, useRef, useCallback } from 'react';

// ── Debug logger ──────────────────────────────────────────────────────────────
const DEBUG = true; // flip false to silence in production
const log    = (...a: unknown[]) => DEBUG && console.log( '%c[VoiceProcess]', 'color:#0ff;font-weight:bold', ...a);
const warn   = (...a: unknown[]) => DEBUG && console.warn('%c[VoiceProcess]', 'color:#fa0;font-weight:bold', ...a);
const dbgErr = (...a: unknown[]) => console.error('%c[VoiceProcess]', 'color:#f44;font-weight:bold', ...a);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoiceResult {
  language:           string;
  local_transcript:   string;
  english_transcript: string;
  local_audio_b64:    string;   // base64 MP3 in the patient's language
  english_audio_b64:  string;   // base64 MP3 in English
  success?:           boolean;
}

export type VoiceStatus = 'idle' | 'recording' | 'done' | 'processing' | 'success' | 'error';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVoiceProcess(language: string = 'Telugu') {
  const [status,  setStatus]  = useState<VoiceStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [result,  setResult]  = useState<VoiceResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const mediaRecorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef          = useRef<Blob[]>([]);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef            = useRef<Blob | null>(null);

  // Promise that resolves once mr.onstop fires and blob is ready
  const blobReadyRef       = useRef<Promise<Blob> | null>(null);
  const blobResolveFnRef   = useRef<((b: Blob) => void) | null>(null);

  // Convenience booleans consumed by the UI
  const isRecording = status === 'recording';
  const done        = status === 'done' || status === 'success';

  // ── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    log('startRecording() called — language:', language);
    setError(null);
    setResult(null);
    setSeconds(0);
    chunksRef.current = [];
    blobRef.current   = null;

    // New promise for this session so processVoice can await blob readiness
    blobReadyRef.current = new Promise<Blob>((resolve) => {
      blobResolveFnRef.current = resolve;
    });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      log('Microphone acquired — tracks:', stream.getAudioTracks().map((t) => t.label));
    } catch (e) {
      dbgErr('getUserMedia failed:', e);
      setError('Microphone access denied. Please allow microphone and try again.');
      return;
    }

    // Pick best supported MIME type
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    log('Using MIME type:', mimeType || '(browser default)');

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        log(`  chunk: ${e.data.size} bytes (total chunks: ${chunksRef.current.length})`);
      }
    };

    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      blobRef.current = blob;
      log(`Recording stopped — blob: ${blob.size} bytes, type: ${blob.type}`);

      // Unblock processVoice if it's already awaiting
      blobResolveFnRef.current?.(blob);
      setStatus('done');
    };

    mr.start(250);
    setStatus('recording');
    log('MediaRecorder started');

    // Auto-stop at 30 seconds
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s >= 29) { stopRecording(); return s; }
        return s + 1;
      });
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    log('stopRecording() called');
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Process recording ───────────────────────────────────────────────────────
  const processVoice = useCallback(async (): Promise<VoiceResult | null> => {
    log('processVoice() called — current status:', status);

    setStatus('processing');
    setError(null);

    // ── Wait for blob if onstop hasn't fired yet (race condition guard) ──────
    let blob: Blob | null = blobRef.current;

    if (!blob && blobReadyRef.current) {
      log('  blob not ready yet — awaiting onstop promise (max 5s)…');
      try {
        blob = await Promise.race([
          blobReadyRef.current,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timed out waiting for recording blob (5 s)')), 5000)
          ),
        ]);
      } catch (e) {
        dbgErr('Blob wait failed:', e);
        setError(e instanceof Error ? e.message : 'Recording not ready');
        setStatus('error');
        return null;
      }
    }

    if (!blob || blob.size === 0) {
      warn('No recording blob found. blobRef.current:', blobRef.current);
      setError('No recording found. Please record first.');
      setStatus('error');
      return null;
    }

    log(`Sending audio — size: ${blob.size} bytes, type: ${blob.type}, language: "${language}"`);

    const form = new FormData();
    form.append('audio_file', blob, 'recording.webm');
    form.append('language', language);

    if (DEBUG) {
      log('FormData entries:');
      form.forEach((v, k) => {
        if (v instanceof Blob) log(`  ${k}: Blob(${v.size} bytes, type="${v.type}")`);
        else log(`  ${k}: "${v}"`);
      });
    }

    try {
      log('▶ POST /api/v1/voice/process');
      const resp = await fetch('/api/v1/voice/process', { method: 'POST', body: form });
      log(`◀ HTTP ${resp.status} ${resp.statusText}`);

      // Read as text first so we can log the raw body
      const raw = await resp.text();
      log('Raw response (first 800 chars):', raw.slice(0, 800));

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw);
      } catch {
        dbgErr('JSON.parse failed on response body:', raw);
        throw new Error(`Server returned non-JSON (HTTP ${resp.status})`);
      }

      log('Parsed response:', {
        success:            data.success,
        language:           data.language,
        local_transcript:   data.local_transcript,
        english_transcript: data.english_transcript,
        local_audio_len:    typeof data.local_audio_b64  === 'string' ? (data.local_audio_b64  as string).length : 'N/A',
        english_audio_len:  typeof data.english_audio_b64 === 'string' ? (data.english_audio_b64 as string).length : 'N/A',
      });

      if (!resp.ok) {
        throw new Error((data.detail as string) || (data.error as string) || `Server error ${resp.status}`);
      }
      if (data.success === false) {
        throw new Error((data.detail as string) || (data.error as string) || 'Voice processing failed');
      }

      if (!data.local_transcript && !data.english_transcript) {
        warn('⚠ Both transcripts are empty — Colab may have returned blank text. Full response:', data);
      }

      const voiceResult = data as unknown as VoiceResult;
      setResult(voiceResult);
      setStatus('success');
      log('✅ processVoice success — returning result to caller');
      return voiceResult;

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      dbgErr('processVoice threw:', e);
      setError(msg);
      setStatus('error');
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    log('reset()');
    stopRecording();
    setStatus('idle');
    setSeconds(0);
    setResult(null);
    setError(null);
    blobRef.current          = null;
    chunksRef.current        = [];
    blobReadyRef.current     = null;
    blobResolveFnRef.current = null;
  }, [stopRecording]);

  return { status, isRecording, done, seconds, result, error, startRecording, stopRecording, processVoice, reset };
}