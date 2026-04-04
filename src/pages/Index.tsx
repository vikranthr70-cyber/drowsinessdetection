import { useDrowsinessDetection } from "@/hooks/useDrowsinessDetection";
import { StatCard } from "@/components/StatCard";
import { EventLog } from "@/components/EventLog";
import { EarChart } from "@/components/EarChart";
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
            disabled={state.loading}
          >
            {state.loading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Loading Model...
              </>
            ) : state.isRunning ? (
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
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <video
                ref={videoRef}
                className="h-full w-full object-cover scale-x-[-1]"
                playsInline
                muted
                autoPlay
              />

              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full pointer-events-none"
              />

              <AlertOverlay
                isDrowsy={state.isDrowsy}
                isYawning={state.isYawning}
              />

              {!state.isRunning && !state.loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/50 backdrop-blur-sm rounded-lg">
                  <MonitorSpeaker className="w-16 h-16 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">
                    Click "Start Detection" to begin monitoring
                  </p>
                </div>
              )}

              {state.loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm rounded-lg">
                  <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Starting camera and loading face tracking…</p>
                </div>
              )}

              {state.isRunning && !state.faceDetected && !state.loading && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-2 text-xs text-muted-foreground">
                  Center your face in the frame and keep good lighting.
                </div>
              )}

              {state.isRunning && (
                <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono text-muted-foreground">
                  {state.fps} FPS
                </div>
              )}
            </div>
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

        {/* Sidebar: Chart + Event Log */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <EarChart data={state.earHistory} />
          <div className="min-h-[250px]">
            <EventLog events={state.events} />
          </div>
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
