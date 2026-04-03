import { useRef, useState, useCallback, useEffect } from "react";

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const UPPER_LIP = 13;
const LOWER_LIP = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;
const FOREHEAD = 10;
const CHIN = 152;

const COLORS = {
  primary: "hsl(199 89% 48%)",
  success: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(0 72% 51%)",
  text: "hsl(210 20% 92%)",
};

export interface DrowsinessEvent {
  id: string;
  type: "drowsiness" | "yawn" | "head_tilt";
  timestamp: Date;
  duration?: number;
  ear?: number;
}

export interface DetectionState {
  isRunning: boolean;
  isDrowsy: boolean;
  isYawning: boolean;
  isHeadTilted: boolean;
  ear: number;
  fps: number;
  blinkCount: number;
  eyeClosedDuration: number;
  mouthOpenRatio: number;
  headTiltAngle: number;
  events: DrowsinessEvent[];
  faceDetected: boolean;
  loading: boolean;
}

const EAR_THRESHOLD = 0.21;
const EYE_CLOSED_THRESHOLD_MS = 2000;
const YAWN_THRESHOLD = 0.6;
const HEAD_TILT_THRESHOLD = 15;

function euclideanDist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function calcEAR(landmarks: Array<{ x: number; y: number }>, eyeIndices: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);
  const vertical1 = euclideanDist(p2, p6);
  const vertical2 = euclideanDist(p3, p5);
  const horizontal = euclideanDist(p1, p4);
  if (horizontal === 0) return 0.3;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function useDrowsinessDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const runningRef = useRef(false);

  const eyeClosedStartRef = useRef<number | null>(null);
  const blinkCountRef = useRef(0);
  const lastBlinkRef = useRef(false);
  const fpsTimesRef = useRef<number[]>([]);
  const lastAlarmRef = useRef(0);

  const [state, setState] = useState<DetectionState>({
    isRunning: false,
    isDrowsy: false,
    isYawning: false,
    isHeadTilted: false,
    ear: 0,
    fps: 0,
    blinkCount: 0,
    eyeClosedDuration: 0,
    mouthOpenRatio: 0,
    headTiltAngle: 0,
    events: [],
    faceDetected: false,
    loading: false,
  });

  const playAlarm = useCallback(() => {
    const now = Date.now();
    if (now - lastAlarmRef.current < 500) return;
    lastAlarmRef.current = now;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") void ctx.resume();

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "square";
      gain.gain.value = 0.22;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    } catch {
      // Ignore audio issues silently
    }
  }, []);

  const addEvent = useCallback((type: DrowsinessEvent["type"], ear?: number, duration?: number) => {
    const event: DrowsinessEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      ear,
      duration,
    };

    setState((prev) => ({
      ...prev,
      events: [event, ...prev.events].slice(0, 50),
    }));
  }, []);

  const clearOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const processResults = useCallback(
    (results: any) => {
      if (!runningRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!video.videoWidth || !video.videoHeight) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      fpsTimesRef.current.push(now);
      fpsTimesRef.current = fpsTimesRef.current.filter((t) => now - t < 1000);
      const fps = fpsTimesRef.current.length;

      if (!results.multiFaceLandmarks?.length) {
        setState((prev) => ({ ...prev, fps, faceDetected: false }));
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];
      const w = canvas.width;
      const h = canvas.height;
      const lm = landmarks.map((point: any) => ({ x: (1 - point.x) * w, y: point.y * h }));

      const drawPolyline = (indices: number[], color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        indices.forEach((idx, index) => {
          const point = lm[idx];
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
      };

      const drawPoints = (indices: number[], color: string, radius = 3) => {
        ctx.fillStyle = color;
        indices.forEach((idx) => {
          const point = lm[idx];
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      };

      const leftEAR = calcEAR(lm, LEFT_EYE);
      const rightEAR = calcEAR(lm, RIGHT_EYE);
      const ear = (leftEAR + rightEAR) / 2;
      const eyesClosed = ear < EAR_THRESHOLD;
      const eyeColor = eyesClosed ? COLORS.danger : COLORS.success;

      drawPolyline(LEFT_EYE, eyeColor);
      drawPolyline(RIGHT_EYE, eyeColor);
      drawPoints(LEFT_EYE, eyeColor);
      drawPoints(RIGHT_EYE, eyeColor);

      const mouthVertical = euclideanDist(lm[UPPER_LIP], lm[LOWER_LIP]);
      const mouthHorizontal = euclideanDist(lm[MOUTH_LEFT], lm[MOUTH_RIGHT]);
      const mouthOpenRatio = mouthHorizontal > 0 ? mouthVertical / mouthHorizontal : 0;
      const isYawning = mouthOpenRatio > YAWN_THRESHOLD;
      const mouthColor = isYawning ? COLORS.warning : COLORS.primary;
      drawPoints([UPPER_LIP, LOWER_LIP, MOUTH_LEFT, MOUTH_RIGHT], mouthColor);

      const forehead = lm[FOREHEAD];
      const chin = lm[CHIN];
      const headTiltAngle = Math.abs(Math.atan2(forehead.x - chin.x, forehead.y - chin.y) * (180 / Math.PI));
      const isHeadTilted = headTiltAngle > HEAD_TILT_THRESHOLD;

      if (!eyesClosed && lastBlinkRef.current) {
        blinkCountRef.current += 1;
      }
      lastBlinkRef.current = eyesClosed;

      let eyeClosedDuration = 0;
      if (eyesClosed) {
        if (!eyeClosedStartRef.current) eyeClosedStartRef.current = now;
        eyeClosedDuration = now - eyeClosedStartRef.current;
      } else {
        eyeClosedStartRef.current = null;
      }

      const isDrowsy = eyeClosedDuration >= EYE_CLOSED_THRESHOLD_MS;

      const xs = lm.map((point: { x: number }) => point.x);
      const ys = lm.map((point: { y: number }) => point.y);
      const minX = Math.max(0, Math.min(...xs) - 20);
      const maxX = Math.min(w, Math.max(...xs) + 20);
      const minY = Math.max(0, Math.min(...ys) - 20);
      const maxY = Math.min(h, Math.max(...ys) + 20);

      ctx.strokeStyle = isDrowsy ? COLORS.danger : COLORS.primary;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.setLineDash([]);

      ctx.font = "700 14px Inter, sans-serif";
      ctx.fillStyle = isDrowsy ? COLORS.danger : COLORS.success;
      ctx.fillText(isDrowsy ? "DROWSINESS ALERT" : "Face detected", minX, Math.max(18, minY - 8));

      ctx.font = "600 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = COLORS.primary;
      ctx.fillText(`EAR ${ear.toFixed(3)}`, minX, Math.min(h - 10, maxY + 18));

      if (isDrowsy) playAlarm();

      setState((prev) => {
        if (isDrowsy && !prev.isDrowsy) addEvent("drowsiness", ear, eyeClosedDuration);
        if (isYawning && !prev.isYawning) addEvent("yawn");
        if (isHeadTilted && !prev.isHeadTilted) addEvent("head_tilt");

        return {
          ...prev,
          ear: Math.round(ear * 1000) / 1000,
          fps,
          blinkCount: blinkCountRef.current,
          eyeClosedDuration: Math.round(eyeClosedDuration),
          isDrowsy,
          isYawning,
          isHeadTilted,
          mouthOpenRatio: Math.round(mouthOpenRatio * 100) / 100,
          headTiltAngle: Math.round(headTiltAngle * 10) / 10,
          faceDetected: true,
        };
      });
    },
    [addEvent, clearOverlay, playAlarm]
  );

  const start = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");

      const win = window as any;
      if (!win.FaceMesh || !win.Camera) {
        throw new Error("MediaPipe failed to initialize");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not found");

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) {
          resolve();
          return;
        }
        video.onloadedmetadata = () => resolve();
      });

      await video.play();

      const faceMesh = new win.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });

      faceMesh.onResults(processResults);
      faceMeshRef.current = faceMesh;
      runningRef.current = true;

      const camera = new win.Camera(video, {
        onFrame: async () => {
          if (!runningRef.current) return;
          await faceMesh.send({ image: video });
        },
        width: video.videoWidth || 960,
        height: video.videoHeight || 540,
      });

      cameraRef.current = camera;
      await camera.start();

      setState((prev) => ({ ...prev, isRunning: true, loading: false }));
    } catch (error) {
      console.error("Failed to start detection:", error);
      runningRef.current = false;
      setState((prev) => ({ ...prev, isRunning: false, loading: false, faceDetected: false }));
    }
  }, [processResults]);

  const stop = useCallback(() => {
    runningRef.current = false;

    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch {
        // ignore
      }
      cameraRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close();
      } catch {
        // ignore
      }
      faceMeshRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    blinkCountRef.current = 0;
    eyeClosedStartRef.current = null;
    lastBlinkRef.current = false;
    fpsTimesRef.current = [];
    clearOverlay();

    setState((prev) => ({
      ...prev,
      isRunning: false,
      isDrowsy: false,
      isYawning: false,
      isHeadTilted: false,
      ear: 0,
      fps: 0,
      blinkCount: 0,
      eyeClosedDuration: 0,
      mouthOpenRatio: 0,
      headTiltAngle: 0,
      faceDetected: false,
      loading: false,
    }));
  }, [clearOverlay]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, canvasRef, state, start, stop };
}
