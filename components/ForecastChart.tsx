"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// Placeholder shape mirrors the monthly_forecast table — replace with live data.
const data = [
  { month: "Mar", production: 49, arbitrage: 0 },
  { month: "Apr", production: 79, arbitrage: 0 },
  { month: "May", production: 148, arbitrage: 0 },
  { month: "Jun", production: 148, arbitrage: 137 },
  { month: "Jul", production: 148, arbitrage: 137 },
  { month: "Aug", production: 148, arbitrage: 137 },
];

export default function ForecastChart() {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            formatter={(v: number) => [`$${v}k`, ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="production" name="Production profit" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
          <Bar dataKey="arbitrage" name="Arbitrage profit" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
