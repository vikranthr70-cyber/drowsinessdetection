import { useRef, useState, useCallback, useEffect } from "react";

// MediaPipe Face Mesh eye landmark indices
// Left eye: 362, 385, 387, 263, 373, 380
// Right eye: 33, 160, 158, 133, 153, 144
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];

// Mouth landmarks for yawn detection
const UPPER_LIP = 13;
const LOWER_LIP = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;

// Nose tip and forehead for head tilt
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;

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
}

const EAR_THRESHOLD = 0.21;
const EYE_CLOSED_THRESHOLD_MS = 2000;
const YAWN_THRESHOLD = 0.6;
const HEAD_TILT_THRESHOLD = 15;

function euclideanDist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function calcEAR(landmarks: any[], eyeIndices: number[]): number {
  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);
  const vertical1 = euclideanDist(p2, p6);
  const vertical2 = euclideanDist(p3, p5);
  const horizontal = euclideanDist(p1, p4);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export function useDrowsinessDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const eyeClosedStartRef = useRef<number | null>(null);
  const blinkCountRef = useRef(0);
  const lastBlinkRef = useRef(false);
  const fpsTimesRef = useRef<number[]>([]);

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
  });

  const playAlarm = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio may fail silently
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

  const processResults = useCallback(
    (results: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame
      ctx.drawImage(video, 0, 0);

      // FPS calculation
      const now = performance.now();
      fpsTimesRef.current.push(now);
      fpsTimesRef.current = fpsTimesRef.current.filter((t) => now - t < 1000);
      const fps = fpsTimesRef.current.length;

      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setState((prev) => ({ ...prev, fps, faceDetected: false }));
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];
      const w = canvas.width;
      const h = canvas.height;

      // Convert normalized landmarks to pixel coords for drawing
      const lm = landmarks.map((l: any) => ({ x: l.x * w, y: l.y * h }));

      // Draw face mesh outline
      ctx.strokeStyle = "hsl(199, 89%, 48%)";
      ctx.lineWidth = 1;

      // Draw eye landmarks
      const drawEye = (indices: number[], color: string) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        indices.forEach((idx, i) => {
          if (i === 0) ctx.moveTo(lm[idx].x, lm[idx].y);
          else ctx.lineTo(lm[idx].x, lm[idx].y);
        });
        ctx.closePath();
        ctx.stroke();

        // Draw dots
        indices.forEach((idx) => {
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(lm[idx].x, lm[idx].y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      };

      // Calculate EAR
      const leftEAR = calcEAR(lm, LEFT_EYE);
      const rightEAR = calcEAR(lm, RIGHT_EYE);
      const ear = (leftEAR + rightEAR) / 2;

      // Determine eye state colors
      const eyeColor = ear < EAR_THRESHOLD ? "hsl(0, 72%, 51%)" : "hsl(142, 71%, 45%)";
      drawEye(LEFT_EYE, eyeColor);
      drawEye(RIGHT_EYE, eyeColor);

      // Mouth open ratio (yawn detection)
      const mouthVertical = euclideanDist(lm[UPPER_LIP], lm[LOWER_LIP]);
      const mouthHorizontal = euclideanDist(lm[MOUTH_LEFT], lm[MOUTH_RIGHT]);
      const mouthOpenRatio = mouthVertical / mouthHorizontal;
      const isYawning = mouthOpenRatio > YAWN_THRESHOLD;

      // Draw mouth landmarks
      const mouthColor = isYawning ? "hsl(38, 92%, 50%)" : "hsl(199, 89%, 48%)";
      [UPPER_LIP, LOWER_LIP, MOUTH_LEFT, MOUTH_RIGHT].forEach((idx) => {
        ctx.beginPath();
        ctx.fillStyle = mouthColor;
        ctx.arc(lm[idx].x, lm[idx].y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Head tilt detection
      const noseTip = lm[NOSE_TIP];
      const forehead = lm[FOREHEAD];
      const chin = lm[CHIN];
      const headTiltAngle = Math.abs(
        Math.atan2(forehead.x - chin.x, forehead.y - chin.y) * (180 / Math.PI)
      );
      const isHeadTilted = headTiltAngle > HEAD_TILT_THRESHOLD;

      // Blink counting
      const eyesClosed = ear < EAR_THRESHOLD;
      if (!eyesClosed && lastBlinkRef.current) {
        blinkCountRef.current++;
      }
      lastBlinkRef.current = eyesClosed;

      // Eye closed duration
      let eyeClosedDuration = 0;
      if (eyesClosed) {
        if (!eyeClosedStartRef.current) {
          eyeClosedStartRef.current = now;
        }
        eyeClosedDuration = now - eyeClosedStartRef.current;
      } else {
        eyeClosedStartRef.current = null;
      }

      const isDrowsy = eyeClosedDuration >= EYE_CLOSED_THRESHOLD_MS;

      // Draw face bounding box
      const xs = lm.map((l: any) => l.x);
      const ys = lm.map((l: any) => l.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const pad = 20;

      ctx.strokeStyle = isDrowsy ? "hsl(0, 72%, 51%)" : "hsl(199, 89%, 48%)";
      ctx.lineWidth = 2;
      ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);

      // Trigger alerts
      if (isDrowsy) {
        playAlarm();
      }

      setState((prev) => {
        const newState: DetectionState = {
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

        // Log events
        if (isDrowsy && !prev.isDrowsy) {
          addEvent("drowsiness", ear, eyeClosedDuration);
        }
        if (isYawning && !prev.isYawning) {
          addEvent("yawn");
        }
        if (isHeadTilted && !prev.isHeadTilted) {
          addEvent("head_tilt");
        }

        return newState;
      });
    },
    [playAlarm, addEvent]
  );

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Load MediaPipe
      const { FaceMesh } = await import("@mediapipe/face_mesh");
      const { Camera } = await import("@mediapipe/camera_utils");

      const faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(processResults);
      faceMeshRef.current = faceMesh;

      const camera = new Camera(videoRef.current!, {
        onFrame: async () => {
          await faceMesh.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
      });

      camera.start();

      setState((prev) => ({ ...prev, isRunning: true }));
    } catch (err) {
      console.error("Failed to start detection:", err);
    }
  }, [processResults]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    blinkCountRef.current = 0;
    eyeClosedStartRef.current = null;

    setState((prev) => ({
      ...prev,
      isRunning: false,
      isDrowsy: false,
      isYawning: false,
      isHeadTilted: false,
      faceDetected: false,
      ear: 0,
      fps: 0,
      blinkCount: 0,
      eyeClosedDuration: 0,
    }));
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { videoRef, canvasRef, state, start, stop };
}
