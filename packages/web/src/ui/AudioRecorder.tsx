import { useRef, useState } from 'react';
import { Button } from './Button.js';

interface AudioRecorderProps {
  /** Called with the recorded clip when the user stops. */
  onRecorded: (clip: Blob, durationS: number) => void;
}

/** Record a short audio hint with the device microphone (MediaRecorder). */
export function AudioRecorder({ onRecorded }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const clip = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const durationS = Math.round((Date.now() - startRef.current) / 1000);
        stream.getTracks().forEach((t) => t.stop());
        onRecorded(clip, durationS);
      };
      startRef.current = Date.now();
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Microphone not available');
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="stack">
      {recording ? (
        <Button variant="danger" onClick={stop}>
          ⏹ Stop recording
        </Button>
      ) : (
        <Button variant="accent" onClick={start} type="button">
          🎙 Record a clue
        </Button>
      )}
      {error && <p className="muted">{error}</p>}
    </div>
  );
}
