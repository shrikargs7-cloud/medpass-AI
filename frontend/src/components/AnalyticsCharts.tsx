import React from 'react';

// 1. Readiness Radial Ring Chart
interface ReadinessRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const ReadinessRing: React.FC<ReadinessRingProps> = ({
  score,
  size = 72,
  strokeWidth = 6
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  let strokeColor = '#10b981'; // emerald-500
  if (score < 60) strokeColor = '#f43f5e'; // rose-500
  else if (score < 85) strokeColor = '#f59e0b'; // amber-500

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-sm font-black text-slate-900 font-mono leading-none">
          {Math.round(score)}
        </span>
        <span className="text-[9px] text-slate-400 font-medium">%</span>
      </div>
    </div>
  );
};

// 2. Financial Waterfall Step Chart
interface FinancialWaterfallProps {
  gross: number;
  covered: number;
  payable: number;
}

export const FinancialWaterfallChart: React.FC<FinancialWaterfallProps> = ({
  gross,
  covered,
  payable
}) => {
  const maxVal = Math.max(gross, 1);
  const coveredPct = Math.round((covered / maxVal) * 100);
  const payablePct = Math.round((payable / maxVal) * 100);

  // Estimates for visual waterfall breakdown
  const roomCapDiff = Math.max(0, Math.round(payable * 0.45));
  const copayDiff = Math.max(0, Math.round(payable * 0.35));
  const deductibleDiff = Math.max(0, payable - roomCapDiff - copayDiff);

  return (
    <div className="space-y-2.5">
      {/* Visual Waterfall Bars */}
      <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
        {/* Step 1: Gross */}
        <div className="flex flex-col items-center">
          <span className="font-bold text-slate-800 text-[11px] mb-1 font-mono">
            ₹{Math.round(gross / 1000)}k
          </span>
          <div className="w-full bg-slate-100 rounded-t-lg h-24 flex items-end justify-center p-1 border-t border-x border-slate-200">
            <div className="w-full bg-slate-700 rounded-t h-full transition-all duration-500" />
          </div>
          <span className="text-slate-500 mt-1 font-semibold">Total Gross</span>
        </div>

        {/* Step 2: Room Cap Excess */}
        <div className="flex flex-col items-center">
          <span className="font-bold text-rose-600 text-[11px] mb-1 font-mono">
            -₹{Math.round(roomCapDiff / 1000)}k
          </span>
          <div className="w-full bg-slate-100 rounded-t-lg h-24 flex items-end justify-center p-1 border-t border-x border-slate-200">
            <div
              className="w-full bg-rose-400 rounded-t transition-all duration-500"
              style={{ height: `${Math.max(15, Math.round((roomCapDiff / maxVal) * 100))}%` }}
            />
          </div>
          <span className="text-slate-500 mt-1 font-semibold">Room Cap</span>
        </div>

        {/* Step 3: Copay / Co-share */}
        <div className="flex flex-col items-center">
          <span className="font-bold text-amber-600 text-[11px] mb-1 font-mono">
            -₹{Math.round(copayDiff / 1000)}k
          </span>
          <div className="w-full bg-slate-100 rounded-t-lg h-24 flex items-end justify-center p-1 border-t border-x border-slate-200">
            <div
              className="w-full bg-amber-400 rounded-t transition-all duration-500"
              style={{ height: `${Math.max(15, Math.round((copayDiff / maxVal) * 100))}%` }}
            />
          </div>
          <span className="text-slate-500 mt-1 font-semibold">10% Copay</span>
        </div>

        {/* Step 4: Insurer Covered */}
        <div className="flex flex-col items-center">
          <span className="font-bold text-emerald-600 text-[11px] mb-1 font-mono">
            ₹{Math.round(covered / 1000)}k
          </span>
          <div className="w-full bg-emerald-50/60 rounded-t-lg h-24 flex items-end justify-center p-1 border-t border-x border-emerald-200">
            <div
              className="w-full bg-emerald-500 rounded-t transition-all duration-500"
              style={{ height: `${coveredPct}%` }}
            />
          </div>
          <span className="text-emerald-700 mt-1 font-bold">Insurer Pays</span>
        </div>

        {/* Step 5: Patient Payable */}
        <div className="flex flex-col items-center">
          <span className="font-bold text-amber-800 text-[11px] mb-1 font-mono">
            ₹{Math.round(payable / 1000)}k
          </span>
          <div className="w-full bg-amber-50/60 rounded-t-lg h-24 flex items-end justify-center p-1 border-t border-x border-amber-200">
            <div
              className="w-full bg-amber-500 rounded-t transition-all duration-500"
              style={{ height: `${payablePct}%` }}
            />
          </div>
          <span className="text-amber-800 mt-1 font-bold">Patient Pays</span>
        </div>
      </div>

      {/* Linear Stacked Ribbon */}
      <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
        <div
          className="bg-emerald-500 h-full transition-all duration-700"
          style={{ width: `${coveredPct}%` }}
          title={`Insurer: ${coveredPct}%`}
        />
        <div
          className="bg-amber-400 h-full transition-all duration-700"
          style={{ width: `${payablePct}%` }}
          title={`Patient: ${payablePct}%`}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5" />
          Insurer Share: {coveredPct}% (₹{covered.toLocaleString('en-IN')})
        </span>
        <span className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1.5" />
          Patient Share: {payablePct}% (₹{payable.toLocaleString('en-IN')})
        </span>
      </div>
    </div>
  );
};

// 3. Claim Pipeline Funnel Chart
interface ClaimFunnelProps {
  total: number;
  ready: number;
  submitted: number;
  approved: number;
}

export const ClaimFunnelChart: React.FC<ClaimFunnelProps> = ({
  total,
  ready,
  submitted,
  approved
}) => {
  const stages = [
    { label: 'Total Intake', count: total, color: 'bg-slate-700', width: '100%' },
    { label: 'Structured & Ready', count: ready, color: 'bg-teal-600', width: `${Math.max(20, Math.round((ready / (total || 1)) * 100))}%` },
    { label: 'Submitted to Gateway', count: submitted, color: 'bg-blue-600', width: `${Math.max(15, Math.round((submitted / (total || 1)) * 100))}%` },
    { label: 'Payer Approved', count: approved, color: 'bg-emerald-600', width: `${Math.max(10, Math.round((approved / (total || 1)) * 100))}%` }
  ];

  return (
    <div className="space-y-2">
      {stages.map((stg) => (
        <div key={stg.label} className="text-xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
            <span>{stg.label}</span>
            <span className="font-mono text-slate-900">{stg.count} cases</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${stg.color}`}
              style={{ width: stg.width }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// 4. Blocker Category Distribution Bars
interface BlockerDistributionProps {
  blockers: { blocker_type: string; is_resolved?: boolean }[];
}

export const BlockerDistributionChart: React.FC<BlockerDistributionProps> = ({ blockers }) => {
  const counts: Record<string, number> = {};
  blockers.forEach((b) => {
    const key = b.blocker_type.replace(/_/g, ' ');
    counts[key] = (counts[key] || 0) + 1;
  });

  const total = blockers.length || 1;

  return (
    <div className="space-y-2 text-xs">
      {Object.entries(counts).map(([type, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <div key={type}>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-0.5">
              <span className="font-medium truncate">{type}</span>
              <span className="font-mono text-slate-800 font-bold">{count} ({pct}%)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 5. Patient Coverage Donut Chart
interface PatientDonutProps {
  covered: number;
  payable: number;
  size?: number;
}

export const PatientCoverageDonut: React.FC<PatientDonutProps> = ({
  covered,
  payable,
  size = 120
}) => {
  const total = Math.max(1, covered + payable);
  const coveredRatio = covered / total;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const coveredOffset = circumference - coveredRatio * circumference;

  return (
    <div className="flex items-center space-x-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#fbbf24" // amber-400
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#10b981" // emerald-500
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={coveredOffset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-base font-black text-slate-900 font-mono leading-none">
            {Math.round(coveredRatio * 100)}%
          </span>
          <span className="text-[10px] text-emerald-700 font-bold">COVERED</span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Insurance Pays</span>
          </div>
          <div className="font-extrabold text-emerald-700 text-sm font-mono mt-0.5">
            ₹{covered.toLocaleString('en-IN')}
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>You Pay</span>
          </div>
          <div className="font-extrabold text-amber-800 text-sm font-mono mt-0.5">
            ₹{payable.toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
};
