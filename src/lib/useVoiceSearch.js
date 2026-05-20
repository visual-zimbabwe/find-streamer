import { useCallback, useEffect, useRef, useState } from 'react';

let speechRecognitionModule;

function getSpeechRecognitionModule() {
  if (speechRecognitionModule !== undefined) return speechRecognitionModule;

  try {
    speechRecognitionModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    speechRecognitionModule = null;
  }

  return speechRecognitionModule;
}

function getTranscript(event) {
  return event?.results?.[0]?.transcript?.trim() || '';
}

function messageForVoiceError(event) {
  if (event?.error === 'not-allowed') {
    return 'Microphone and speech recognition permission are needed for voice search.';
  }

  if (event?.error === 'service-not-allowed' || event?.error === 'language-not-supported') {
    return 'Voice search is not available on this device.';
  }

  if (event?.error === 'no-speech') {
    return 'No speech was detected. Try speaking closer to the microphone.';
  }

  return event?.message || 'Voice search could not hear you. Please try again.';
}

export function useVoiceSearch({ onTranscript, onError }) {
  const [listening, setListening] = useState(false);
  const moduleRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionModule();
    moduleRef.current = SpeechRecognition;

    if (!SpeechRecognition?.addListener) return undefined;

    const subscriptions = [
      SpeechRecognition.addListener('start', () => setListening(true)),
      SpeechRecognition.addListener('end', () => setListening(false)),
      SpeechRecognition.addListener('result', (event) => {
        const transcript = getTranscript(event);
        if (transcript) onTranscript(transcript);
      }),
      SpeechRecognition.addListener('error', (event) => {
        setListening(false);
        if (event?.error !== 'aborted') onError(messageForVoiceError(event));
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      try {
        SpeechRecognition.abort();
      } catch {
        // The native recognizer may already be inactive during unmount.
      }
    };
  }, [onError, onTranscript]);

  const toggleVoiceSearch = useCallback(async () => {
    const SpeechRecognition = moduleRef.current || getSpeechRecognitionModule();
    moduleRef.current = SpeechRecognition;

    if (!SpeechRecognition) {
      onError('Voice search is unavailable in this app build.');
      return;
    }

    if (listening) {
      SpeechRecognition.stop();
      return;
    }

    try {
      if (SpeechRecognition.isRecognitionAvailable && !SpeechRecognition.isRecognitionAvailable()) {
        onError('Voice search is not available on this device.');
        return;
      }

      const permission = await SpeechRecognition.requestPermissionsAsync();
      if (!permission.granted) {
        onError('Microphone and speech recognition permission are needed for voice search.');
        return;
      }

      SpeechRecognition.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        iosTaskHint: 'search',
      });
    } catch {
      setListening(false);
      onError('Voice search could not start. Please try again.');
    }
  }, [listening, onError]);

  return {
    listening,
    toggleVoiceSearch,
  };
}
