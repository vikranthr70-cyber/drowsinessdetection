import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { EarDataPoint } from "@/hooks/useDrowsinessDetection";

interface EarChartProps {
  data: EarDataPoint[];
}

export function EarChart({ data }: EarChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        index: i,
        ear: d.ear,
      })),
    [data]
  );

  return (
    <div className="glass-panel p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        EAR Real-Time Chart
      </h3>
      {chartData.length < 2 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          Waiting for data…
        </div>
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="index" tick={false} axisLine={false} />
              <YAxis
                domain={[0, 0.5]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                y={0.21}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 3"
                label={{
                  value: "Threshold",
                  position: "right",
                  fontSize: 10,
                  fill: "hsl(var(--destructive))",
                }}
              />
              <Line
                type="monotone"
                dataKey="ear"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
