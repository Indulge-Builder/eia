"use client";

// SpendDonut — page-local donut for the spending overview, on raw Recharts +
// useChartTokens (the shared DonutChart wrapper was consolidated away on main,
// R-04: consumers compose Recharts directly). No paper chrome here — ChartCard
// owns the container.

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useChartTokens } from "@/components/ui/charts/useChartTokens";

export interface SpendSlice {
  label: string;
  value: number;
}

export function SpendDonut({ data, height = 240 }: { data: SpendSlice[]; height?: number }) {
  const tokens = useChartTokens();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={tokens.series[i % tokens.series.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: tokens.tooltipBg,
            border: `1px solid ${tokens.tooltipBorder}`,
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-2)",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-sans)", color: tokens.axisLabel }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
