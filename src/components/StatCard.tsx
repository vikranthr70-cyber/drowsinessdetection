import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  status?: "normal" | "warning" | "danger";
}

export function StatCard({ label, value, icon, status = "normal" }: StatCardProps) {
  return (
    <div
      className={cn(
        "glass-panel p-4 flex items-center gap-3 transition-all duration-300",
        status === "danger" && "border-destructive/50 shadow-[0_0_15px_hsl(var(--destructive)/0.2)]",
        status === "warning" && "border-warning/50 shadow-[0_0_15px_hsl(var(--warning)/0.2)]"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg",
          status === "normal" && "bg-primary/10 text-primary",
          status === "warning" && "bg-warning/10 text-warning",
          status === "danger" && "bg-destructive/10 text-destructive"
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p
          className={cn(
            "text-lg font-semibold font-mono",
            status === "normal" && "text-foreground",
            status === "warning" && "text-warning",
            status === "danger" && "text-destructive"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
