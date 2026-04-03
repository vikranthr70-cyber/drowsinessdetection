import { useDrowsinessDetection } from "@/hooks/useDrowsinessDetection";
import { StatCard } from "@/components/StatCard";
import { EventLog } from "@/components/EventLog";
import { AlertOverlay } from "@/components/AlertOverlay";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  Activity,
  Timer,
  Zap,
  MonitorSpeaker,
  Camera,
  CameraOff,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

const Index = () => {
  const { videoRef, canvasRef, state, start, stop } = useDrowsinessDetection();

  const earStatus = state.ear < 0.21 ? "danger" : state.ear < 0.25 ? "warning" : "normal";
  const closedStatus =
    state.eyeClosedDuration > 2000
      ? "danger"
      : state.eyeClosedDuration > 1000
        ? "warning"
        : "normal";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              DrowsiGuard
            </h1>
            <p className="text-xs text-muted-foreground">
              AI-Powered Driver Drowsiness Detection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 glass-panel text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                state.isRunning
                  ? state.faceDetected
                    ? "bg-success animate-status-glow"
                    : "bg-warning animate-status-glow"
                  : "bg-muted-foreground"
              }`}
            />
            <span className="text-muted-foreground">
              {state.isRunning
                ? state.faceDetected
                  ? "Monitoring"
                  : "No Face"
                : "Idle"}
            </span>
          </div>

          <Button
            onClick={state.isRunning ? stop : start}
            variant={state.isRunning ? "destructive" : "default"}
            className="gap-2"
          >
            {state.isRunning ? (
              <>
                <CameraOff className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Start Detection
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-[1400px] mx-auto">
        {/* Video Feed */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-1 relative overflow-hidden">
            <AlertOverlay
              isDrowsy={state.isDrowsy}
              isYawning={state.isYawning}
              isHeadTilted={state.isHeadTilted}
            />

            {/* Hidden video element for MediaPipe */}
            <video ref={videoRef} className="hidden" playsInline muted />

            {/* Canvas with detection overlay */}
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg bg-muted aspect-video"
            />

            {!state.isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/50 backdrop-blur-sm rounded-lg">
                <MonitorSpeaker className="w-16 h-16 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  Click "Start Detection" to begin monitoring
                </p>
              </div>
            )}

            {/* FPS Badge */}
            {state.isRunning && (
              <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono text-muted-foreground">
                {state.fps} FPS
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <StatCard
              label="EAR"
              value={state.ear.toFixed(3)}
              icon={<Eye className="w-4 h-4" />}
              status={earStatus}
            />
            <StatCard
              label="Eyes Closed"
              value={`${(state.eyeClosedDuration / 1000).toFixed(1)}s`}
              icon={<EyeOff className="w-4 h-4" />}
              status={closedStatus}
            />
            <StatCard
              label="Blinks"
              value={state.blinkCount}
              icon={<Activity className="w-4 h-4" />}
            />
            <StatCard
              label="Mouth Ratio"
              value={state.mouthOpenRatio.toFixed(2)}
              icon={<Timer className="w-4 h-4" />}
              status={state.isYawning ? "warning" : "normal"}
            />
            <StatCard
              label="Head Tilt"
              value={`${state.headTiltAngle.toFixed(1)}°`}
              icon={<RotateCcw className="w-4 h-4" />}
              status={state.isHeadTilted ? "warning" : "normal"}
            />
            <StatCard
              label="FPS"
              value={state.fps}
              icon={<Zap className="w-4 h-4" />}
              status={state.fps < 10 ? "warning" : "normal"}
            />
          </div>
        </div>

        {/* Event Log Sidebar */}
        <div className="lg:col-span-1 min-h-[400px]">
          <EventLog events={state.events} />
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-[1400px] mx-auto mt-8">
        <div className="glass-panel p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <h3 className="text-foreground font-medium mb-1">👁️ Eye Aspect Ratio (EAR)</h3>
              <p>
                Calculates the ratio of eye height to width using facial landmarks. When EAR drops
                below 0.21, eyes are considered closed.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">⏱️ Duration Threshold</h3>
              <p>
                If eyes remain closed for more than 2 seconds, a drowsiness alert triggers with
                audio and visual warnings.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-1">🔊 Multi-Signal Detection</h3>
              <p>
                Combines EAR, yawn detection (mouth aspect ratio), and head tilt angle for
                comprehensive drowsiness monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
