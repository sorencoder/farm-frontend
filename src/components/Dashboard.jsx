// NOTE: This file is production-ready and mobile-first.
// It connects to your existing Socket.IO backend (farm_update event)
// TailwindCSS required

import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Droplets,
  Thermometer,
  Wind,
  Power,
  AlertCircle,
  CheckCircle2,
  Clock,
  Activity,
  Tractor,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ================= CONFIG ================= */

/* ================= SOCKET SINGLETON ================= */
let socket;
const getSocket = () => {
  if (!socket) {
    socket = io("https://farm-dv9a.onrender.com", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
  }
  return socket;
};

/* ================= DASHBOARD ================= */
export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState({
    s_raw: 0,
    s_pct: 0,
    s_temp: null,
    a_temp: null,
    hum: null,
    pump: 0,
    man: 0,
    life: 0,
    ts: null,
  });
  const [history24h, setHistory24h] = useState([]);
  const [trends24h, setTrends24h] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  const [history, setHistory] = useState([]);

  /* ================= SOCKET HANDLING ================= */
  useEffect(() => {
    const s = getSocket();

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("telemetry:init", (payload) => {
      setTelemetry({ ...payload, ts: Date.now() });
    });

    +s.on("telemetry:update", (payload) => {
      setTelemetry({
        ...payload,
        ts: Date.now(),
      });

      setHistory((prev) => {
        const next = [...prev, payload.s_pct || 0];
        return next.slice(-24);
      });
    });

    return () => {
      s.off("telemetry:init");
      s.off("telemetry:update");
    };
  }, []);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const [historyRes, trendsRes] = await Promise.all([
          fetch("https://farm-dv9a.onrender.com/api/history"),
          fetch("https://farm-dv9a.onrender.com/api/trends"),
        ]);

        const historyData = await historyRes.json();
        const trendsData = await trendsRes.json();
        // console.log(historyData);

        setHistory24h(historyData);
        setTrends24h(trendsData);
      } catch (err) {
        console.error("Chart fetch failed", err);
      } finally {
        setLoadingCharts(false);
      }
    };

    fetchCharts();
  }, []);

  /* ================= DERIVED UI STATE ================= */
  const pumpLabel = telemetry.pump
    ? "ON"
    : telemetry.man
      ? "FORCED OFF"
      : "OFF";

  const pumpStyle = useMemo(() => {
    if (pumpLabel === "ON")
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (pumpLabel === "FORCED OFF")
      return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  }, [pumpLabel]);

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <Tractor className="text-white" size={18} />
            </div>
            <div>
              <h1 className="font-bold leading-none">AgriSmart</h1>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                />
                <span className="text-[10px] uppercase text-slate-400 font-bold">
                  {connected ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-full border">
            <Clock size={14} />
            <span className="text-xs font-mono">
              {telemetry.ts
                ? new Date(telemetry.ts).toLocaleTimeString()
                : "--:--"}
            </span>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SOIL MOISTURE */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={<Droplets />} title="Soil Moisture">
            <div className="flex justify-between items-end">
              <div className="text-5xl font-black">
                {telemetry.s_pct}
                <span className="text-xl">%</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                RAW {telemetry.s_raw}
              </div>
            </div>
            <MiniBarGraph values={history} />
          </Card>

          {/* ENVIRONMENT */}
          <Card icon={<Thermometer />} title="Environment">
            <Stat label="Air Temp" value={`${telemetry.a_temp ?? "--"} °C`} />
            <Stat label="Humidity" value={`${telemetry.hum ?? "--"} %`} />
            <Stat label="Soil Temp" value={`${telemetry.s_temp ?? "--"} °C`} />
          </Card>

          {/* PUMP */}
          <Card icon={<Power />} title="Irrigation Pump">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold">Relay Controlled</p>
                  <p className="text-xs text-slate-400">
                    Mode: {telemetry.man ? "Manual" : "Auto"}
                  </p>
                </div>
              </div>

              <div
                className={`px-4 py-2 rounded-xl border font-bold flex items-center gap-1 ${pumpStyle}`}
              >
                {pumpLabel === "ON" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
                {pumpLabel}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Lifetime: {telemetry.life} min
            </div>
          </Card>
        </section>
        <section>
          <Card icon={<Wind />} title="Environment · Last 24h">
            <div
              style={{ height: "260px", width: "100%" }}
              className="transition-opacity duration-300"
            >
              {loadingCharts ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Loading…
                </div>
              ) : trends24h.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends24h}>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                      labelFormatter={(t) => new Date(t).toLocaleString()}
                    />

                    <Line
                      type="monotone"
                      dataKey="air_temp"
                      name="Air Temperature (°C)"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                    />

                    <Line
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No data…
                </div>
              )}
            </div>
          </Card>
        </section>
        <section>
          <Card icon={<Droplets />} title="Soil Moisture · Last 24h">
            <div
              style={{ height: "260px", width: "100%" }}
              className="transition-opacity duration-300"
            >
              {loadingCharts ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Loading…
                </div>
              ) : history24h.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history24h}>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="soil_pct"
                      name="Soil Moisture (%)"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No data…
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>

      <footer className="text-center text-[10px] text-slate-400 py-6">
        SmartFarm IoT · Node‑01
      </footer>
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Card({ icon, title, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 border shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-slate-100 rounded-xl">{icon}</div>
        <h2 className="text-xs uppercase font-bold text-slate-400">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function MiniBarGraph({ values }) {
  return (
    <div className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div
          key={i}
          className="bg-blue-400/40 flex-1 rounded"
          style={{ height: `${Math.max(v, 8)}%` }}
        />
      ))}
    </div>
  );
}
