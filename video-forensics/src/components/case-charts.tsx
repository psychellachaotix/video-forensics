import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Laptop, BarChart2 } from 'lucide-react';
import type { Analysis, Evidence, PipelineStep } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/use-language';

export function EditingSoftwareCard({ editingSoftware }: { editingSoftware?: Analysis['metadata']['editingSoftware'] }) {
  const { t } = useLanguage();
  if (!editingSoftware) return null;

  let statusText = t.softwareNoMatch || 'Software not matched';
  let statusColor = 'text-muted-foreground';
  
  if (editingSoftware.detected) {
    statusText = t.softwareDetected || 'Software tags found';
    statusColor = 'text-amber-400';
  } else if (editingSoftware.source === 'tag_absent') {
    statusText = t.softwareTagAbsent || 'No edit tags';
    statusColor = 'text-teal-400';
  }

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary">
        <Laptop className="h-3.5 w-3.5" /> {t.detectedSoftware || 'Detected software'}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className={`font-mono text-xs font-semibold uppercase tracking-[.1em] ${statusColor}`}>
          {statusText}
        </div>
        <div className="text-xl font-medium tracking-tight">
          {editingSoftware.name || '—'}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2 border-t border-border pt-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Source</div>
            <div className="mt-1 font-mono text-xs text-foreground">{editingSoftware.source || '—'}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Raw Encoder</div>
            <div className="mt-1 font-mono text-xs text-foreground">{editingSoftware.rawEncoder || '—'}</div>
          </div>
        </div>
        {editingSoftware.evidence && (
           <div className="mt-2 border-t border-border pt-4">
            <div className="font-mono text-[9px] uppercase tracking-[.1em] text-muted-foreground">Evidence</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground break-all">{editingSoftware.evidence}</div>
           </div>
        )}
      </div>
    </section>
  );
}

function getSeverityColor(severity: string) {
  if (severity === 'high') return 'hsl(4, 77%, 61%)'; // destructive red
  if (severity === 'medium') return 'hsl(38, 92%, 63%)'; // amber
  return 'hsl(180, 47%, 54%)'; // teal
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="border border-border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-foreground mb-1">{label || payload[0].payload.name || payload[0].name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="font-mono" style={{ color: entry.color || entry.fill }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function EvidenceTimelineChart({ evidence, duration }: { evidence: Evidence[]; duration: number }) {
  const { t } = useLanguage();
  
  const data = useMemo(() => {
    return evidence
      .filter((e) => e.timestampSeconds != null)
      .map((e) => ({
        x: e.timestampSeconds,
        y: e.category,
        z: e.severity === 'high' ? 3 : e.severity === 'medium' ? 2 : 1,
        severity: e.severity,
        title: e.title,
      }));
  }, [evidence]);

  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground font-mono uppercase tracking-widest">
        {t.noDataAvailable || 'No data available'}
      </div>
    );
  }

  // Get unique categories for Y-axis
  const categories = Array.from(new Set(data.map(d => d.y)));

  return (
    <div
      className="h-[250px] w-full"
      role="img"
      aria-label={`${t.evidenceTimeline || 'Evidence timeline'}: ${data.map((item) => `${item.title}, ${item.x}s, ${item.severity}`).join('; ')}`}
    >
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-primary flex gap-2 items-center">
         <BarChart2 className="w-3.5 h-3.5" /> {t.evidenceTimeline || 'Evidence timeline'}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Time (s)" 
            domain={[0, duration > 0 ? duration : 'auto']} 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--app-font-mono)' }}
            tickFormatter={(val) => `${val}s`}
            stroke="hsl(var(--border))"
          />
          <YAxis 
            type="category" 
            dataKey="y" 
            name="Category" 
            allowDuplicatedCategory={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--app-font-mono)' }}
            stroke="hsl(var(--border))"
          />
          <ZAxis type="number" dataKey="z" range={[50, 200]} name="Severity" />
          <RechartsTooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-foreground">{data.title}</p>
                    <p className="font-mono text-muted-foreground mt-1">{data.x}s • {data.severity}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter name="Findings" data={data}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDistributionChart({ evidence }: { evidence: Evidence[] }) {
  const { t } = useLanguage();
  
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    evidence.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [evidence]);

  if (!data.length) return null;

  return (
    <div
      className="h-[200px] w-full"
      role="img"
      aria-label={`${t.categoryDistribution || 'Findings by category'}: ${data.map((item) => `${item.name} ${item.count}`).join('; ')}`}
    >
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-primary flex gap-2 items-center">
         <BarChart2 className="w-3.5 h-3.5" /> {t.categoryDistribution || 'Findings by category'}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={100}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'var(--app-font-mono)' }}
            stroke="hsl(var(--border))"
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary)/0.05)' }} />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 2, 2, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PipelineStatusChart({ steps }: { steps: PipelineStep[] }) {
  const { t } = useLanguage();
  
  const data = useMemo(() => {
    if (!steps || !steps.length) return [];
    let ok = 0, err = 0, unavail = 0;
    steps.forEach(s => {
      if (s.stepStatus === 'OK') ok++;
      else if (s.stepStatus === 'CHYBA') err++;
      else if (s.stepStatus === 'NEDOSTUPNE') unavail++;
    });
    return [
      { name: 'OK', value: ok, fill: 'hsl(180, 47%, 54%)' },
      { name: 'NEDOSTUPNE', value: unavail, fill: 'hsl(var(--muted-foreground))' },
      { name: 'CHYBA', value: err, fill: 'hsl(4, 77%, 61%)' },
    ].filter(d => d.value > 0);
  }, [steps]);

  if (!data.length) return null;

  return (
    <div
      className="h-[200px] w-full flex flex-col"
      role="img"
      aria-label={`${t.pipelineStatus || 'Pipeline status'}: ${data.map((item) => `${item.name} ${item.value}`).join('; ')}`}
    >
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-primary flex gap-2 items-center">
         <BarChart2 className="w-3.5 h-3.5" /> {t.pipelineStatus || 'Pipeline status'}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2 pb-2">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
            {entry.name} ({entry.value})
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisCharts({ analysis }: { analysis: Analysis }) {
  if (!analysis) return null;

  return (
    <section className="border border-border bg-card p-5">
      <div className="space-y-6">
        {analysis.mediaType === 'video' && analysis.evidence && analysis.evidence.length > 0 && (
          <EvidenceTimelineChart evidence={analysis.evidence} duration={analysis.metadata.duration || 0} />
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {analysis.evidence && analysis.evidence.length > 0 && (
            <CategoryDistributionChart evidence={analysis.evidence} />
          )}
          {analysis.pipelineSteps && analysis.pipelineSteps.length > 0 && (
            <PipelineStatusChart steps={analysis.pipelineSteps} />
          )}
        </div>
      </div>
    </section>
  );
}
