'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { SpeakerHighIcon, StopIcon } from './icons';

const noSubscribe = (): (() => void) => () => undefined;
const supported = (): boolean => 'speechSynthesis' in window;

/**
 * Reads the day aloud with the browser's own voice, so the elder can listen instead of read.
 * Hidden where the browser has no speech support. Speech stops when the page is left.
 */
export function ReadAloud({ text }: { text: string }) {
  const canSpeak = useSyncExternalStore(noSubscribe, supported, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!canSpeak) return null;

  function toggle(): void {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button type="button" className="btn btn-secondary no-print" onClick={toggle}>
      {speaking ? <StopIcon aria-hidden weight="bold" size={24} /> : <SpeakerHighIcon aria-hidden weight="bold" size={24} />}
      {speaking ? 'Stop reading' : 'Read my day aloud'}
    </button>
  );
}
