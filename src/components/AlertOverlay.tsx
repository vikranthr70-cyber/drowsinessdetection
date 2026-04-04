import { AlertTriangle } from "lucide-react";

interface AlertOverlayProps {
  isDrowsy: boolean;
  isYawning: boolean;
}

export function AlertOverlay({ isDrowsy, isYawning }: AlertOverlayProps) {
  if (!isDrowsy && !isYawning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
      {isDrowsy && (
        <div className="absolute inset-0 bg-destructive/20 animate-alert-pulse rounded-xl" />
      )}
      <div className="relative z-20 flex flex-col items-center gap-2">
        {isDrowsy && (
          <div className="bg-destructive/90 backdrop-blur-sm px-6 py-3 rounded-xl flex items-center gap-3 animate-slide-up">
            <AlertTriangle className="w-6 h-6 text-destructive-foreground" />
            <span className="text-destructive-foreground font-bold text-lg tracking-wide">
              🔊 DROWSINESS ALERT! WAKE UP!
            </span>
          </div>
        )}
        {isYawning && !isDrowsy && (
          <div className="bg-warning/90 backdrop-blur-sm px-5 py-2 rounded-lg flex items-center gap-2 animate-slide-up">
            <span className="text-warning-foreground font-semibold text-sm">
              Yawning Detected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
