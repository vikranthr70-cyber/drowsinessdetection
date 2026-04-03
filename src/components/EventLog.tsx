import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, Mic2, RotateCcw } from "lucide-react";
import type { DrowsinessEvent } from "@/hooks/useDrowsinessDetection";

interface EventLogProps {
  events: DrowsinessEvent[];
}

const eventIcons = {
  drowsiness: <AlertTriangle className="w-4 h-4 text-destructive" />,
  yawn: <Mic2 className="w-4 h-4 text-warning" />,
  head_tilt: <RotateCcw className="w-4 h-4 text-primary" />,
};

const eventLabels = {
  drowsiness: "Drowsiness Detected",
  yawn: "Yawn Detected",
  head_tilt: "Head Tilt Detected",
};

export function EventLog({ events }: EventLogProps) {
  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Eye className="w-4 h-4" />
        Event Log
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No events yet. Start detection to monitor.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-xs animate-slide-up",
                event.type === "drowsiness" && "bg-destructive/10",
                event.type === "yawn" && "bg-warning/10",
                event.type === "head_tilt" && "bg-primary/10"
              )}
            >
              {eventIcons[event.type]}
              <span className="flex-1 text-foreground">{eventLabels[event.type]}</span>
              <span className="text-muted-foreground font-mono">
                {event.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
