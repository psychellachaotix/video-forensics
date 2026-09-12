import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowLeft, Bot, CheckCircle2, ChevronDown, Copy, Download, FileImage, FileVideo, Fingerprint, Gauge, HardDrive, Play, Printer, RefreshCw, ShieldAlert, SkipBack, SkipForward, Terminal, Trash2 } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import {
  getGetAnalysisQueryKey,
  getGetAnalysisPreviewUrl,
  getStreamAnalysisSourceUrl,
  getGetDashboardSummaryQueryKey,
  getListAnalysesQueryKey,
  useDeleteAnalysis,
  useGetAnalysis,
  useReanalyzeVideo,
  useSetManualVerdict,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ConfidenceMeter, EmptyState, ForensicsShell, StatusBadge, TopBar, VerdictBadge } from '@/components/forensics-ui';
import { AnalysisCharts, EditingSoftwareCard } from '@/components/case-charts';
import { useLanguage } from '@/lib/use-language';
import { canSeekToFinding, seekVideoToFinding } from '@/lib/finding-navigation';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'error' in error) return String((error as { error: unknown }).error);
  return 'The operation could not be completed.';
}

function formatDuration(value: number) {
  if (!Number.isFinite(value)) return '—';
  const total = Math.round(value);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function phaseLabel(phase: string | null | undefined, t: any) {
  const labels: Record<string, string> = {
    preparation: t.progressPreparation,
    technical: t.progressTechnical,
    evidence: t.progressEvidence,
    interpret: t.progressInterpret,
    verifier: t.progressVerifier,
    finalization: t.progressFinalization,
  };
  return labels[phase ?? ''] ?? t.progressTechnical;
}

function AnalysisProgressPanel({ item, t, elapsed }: { item: any; t: any; elapsed: number }) {
  const percent = Math.max(0, Math.min(100, Number(item.progressPercent) || 0));
  const eta = item.etaSeconds == null ? null : Math.max(0, Number(item.etaSeconds));
  const phase = phaseLabel(item.progressPhase, t);
  return <section data-testid="analysis-progress-panel" aria-label={t.progressTitle} className="border border-primary/30 bg-card p-5 shadow-[0_0_30px_rgba(157,211,21,0.06)] sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="relative mx-auto flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-[5px] sm:mx-0"
        style={{ background: `conic-gradient(hsl(var(--primary)) ${percent}%, hsl(var(--muted)) ${percent}% 100%)` }}
        aria-hidden="true"
      >
        <div className="absolute inset-[5px] rounded-full bg-card" />
        <div className="relative text-center"><div className="font-mono text-3xl font-semibold tracking-[-.08em] text-foreground">{percent}%</div><div className="font-mono text-[8px] uppercase tracking-[.16em] text-muted-foreground">SCAN</div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.progressTitle}</div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">{phase}</h3>
          <span className="font-mono text-xs text-foreground">{percent}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t.progressTitle}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}% — ${phase}`}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">
          <span>{t.elapsed}: {formatDuration(elapsed)}</span>
          <span>{t.estimatedRemaining}: {eta == null ? '—' : formatDuration(eta)}</span>
        </div>
        {item.progressEstimated && <div className="mt-2 text-[11px] text-amber-300">{t.estimateOnly}</div>}
      </div>
    </div>
  </section>;
}

function parseFrameRate(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 25;
  if (!value) return 25;
  const [numerator, denominator = '1'] = value.split('/');
  const fps = Number(numerator) / Number(denominator);
  return Number.isFinite(fps) && fps > 0 ? fps : 25;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ResultList({ items, emptyLabel, tone }: { items?: string[]; emptyLabel: string; tone: 'confirmed' | 'disputed' }) {
  if (!items?.length) return <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>;
  return <ul className="mt-2 space-y-2">{items.map((text, index) => <li key={`${text}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'confirmed' ? 'bg-teal-400' : 'bg-amber-400'}`} />{text}</li>)}</ul>;
}

type DiagnosticRegion = { x: number; y: number; width: number; height: number; score: number; label: string };

function ImageDiagnosticOverlay({ regions, naturalSize }: { regions: DiagnosticRegion[]; naturalSize: { width: number; height: number } | null }) {
  if (!naturalSize || !regions.length) return null;
  return <div className="pointer-events-none absolute inset-0">
    {regions.map((region, index) => <div
      key={`${region.x}-${region.y}-${index}`}
      className="absolute border-2 border-amber-300 bg-amber-300/10"
      style={{
        left: `${region.x / naturalSize.width * 100}%`,
        top: `${region.y / naturalSize.height * 100}%`,
        width: `${region.width / naturalSize.width * 100}%`,
        height: `${region.height / naturalSize.height * 100}%`,
      }}
      title={`${region.label} (${Math.round(region.score * 100)} %)`}
    ><span className="absolute left-0 top-0 max-w-40 bg-black/80 px-1 py-0.5 font-mono text-[8px] text-amber-100">{index + 1}</span></div>)}
  </div>;
}

function ForensicPipeline({
  item,
  metadata,
  evidence,
  seekToFinding,
  onReanalyze,
  reanalyzePending,
  t,
  copied,
  handleCopyMetadata,
  downloadMetadataJson,
  progress,
  elapsed,
}: any) {
  const [openStage, setOpenStage] = useState<number | null>(item.status === 'analyzing' ? 2 : 2);

  const interpretVerdict = item.interpretResult?.verdict === 'ORIGINAL'
    ? 'ORIGINÁL'
    : item.interpretResult?.verdict === 'UPRAVENO'
      ? 'UPRAVENO'
      : item.interpretResult?.verdict === 'UPRAVENO_AI'
        ? 'UPRAVENO_AI'
        : item.interpretResult?.verdict === 'CELE_AI'
          ? 'CELE_AI'
          : 'NEURČENO';

  const stages = [
    {
      id: 1,
      title: t.mediaSignature,
      state: metadata.container ? 'complete' : (item.status === 'failed' ? 'error' : 'analyzing'),
      icon: Fingerprint,
      metric: metadata.container ? `${metadata.container} / ${metadata.codec}` : '',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
            {[[t.encoder, metadata.encoder], [t.bitrate, metadata.bitrate ? `${metadata.bitrate.toLocaleString()} bps` : null], [t.frameRate, metadata.frameRate], [t.resolution, metadata.resolution], [t.createdAt, formatDate(metadata.createdAt)], [t.modifiedAt, formatDate(metadata.modifiedAt)]].map(([label, value]) => <div key={label as string} className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0 sm:nth-[5]:border-0 sm:nth-[6]:border-0"><span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">{label}</span><span data-testid={`metadata-${String(label).toLowerCase().replace(/\s/g, '-')}`} className="max-w-[60%] truncate text-right font-mono text-xs text-foreground">{value || t.notPresent}</span></div>)}
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground"><Fingerprint className="h-3.5 w-3.5 text-primary" /> {t.objectPath}</div>
            <div className="mt-2 break-all font-mono text-[10px] leading-5 text-muted-foreground">{item.objectPath || t.notPresent}</div>
          </div>
          {metadata.allMetadata && (
            <div className="border-t border-border pt-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.allMetadata}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyMetadata}>
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? t.copied : t.copyMetadata}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadMetadataJson}>
                    <Download className="h-3.5 w-3.5" /> {t.downloadJson}
                  </Button>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-sm border border-border bg-[#0d1117] p-4 text-xs shadow-inner">
                <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10" />
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  <pre
                    className="font-mono leading-relaxed text-[#c9d1d9] selection:bg-primary/30 whitespace-pre-wrap break-all"
                    dangerouslySetInnerHTML={{
                      __html: JSON.stringify(metadata.allMetadata, null, 2)
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/"([^"]+)":/g, '<span style="color:#7ee787">"$1"</span>:')
                        .replace(/: "([^"]+)"/g, ': <span style="color:#a5d6ff">"$1"</span>')
                        .replace(/: (\d+(?:\.\d+)?)/g, ': <span style="color:#79c0ff">$1</span>')
                        .replace(/: (true|false|null)/g, ': <span style="color:#ff7b72">$1</span>')
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 2,
      title: t.findingsLedger,
      state: item.status === 'analyzing' ? 'analyzing' : item.status === 'failed' ? 'error' : 'complete',
      icon: Activity,
      metric: item.status === 'complete' ? `${evidence.length} ${t.evidenceItems}` : '',
      content: item.status === 'analyzing' ? (
        <AnalysisProgressPanel item={progress} t={t} elapsed={elapsed} />
      ) : evidence.length === 0 ? (
        <EmptyState title={t.noFindings} detail={t.noFindingsDetail} icon={<Gauge className="h-5 w-5" />} />
      ) : (
        <div className="space-y-0 divide-y divide-border">
          <div className="flex justify-end gap-2 pb-4">
            <Button type="button" variant="outline" size="sm" data-testid="button-print-report" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> {t.print}</Button>
          </div>
          {evidence.map((finding: any, index: number) => (
             <div key={`${finding.title}-${index}`} data-testid={`finding-${index}`} className="grid gap-3 py-5 first:pt-2 last:pb-2 md:grid-cols-[120px_1fr_100px] md:items-start">
               <div className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                 {finding.category}
                 {canSeekToFinding(item.mediaType, finding.timestampSeconds) ? <button type="button" data-testid={`button-seek-finding-${index}`} onClick={() => seekToFinding(finding.timestampSeconds)} className="mt-2 flex items-center gap-1 text-[9px] text-primary hover:underline"><Play className="h-2.5 w-2.5" />{finding.timestamp}</button> : <div className="mt-2 text-[9px] text-muted-foreground">{t.noTimestamp}</div>}
               </div>
               <div>
                 <div className="text-sm font-medium text-foreground">{finding.title}</div>
                 <p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.detail}</p>
                  {finding.score != null && <div className="mt-2 font-mono text-[9px] uppercase text-primary">Skóre {Math.round(finding.score * 100)} %</div>}
                  {finding.regions?.length ? <ul className="mt-2 space-y-1">{finding.regions.map((region: DiagnosticRegion, regionIndex: number) => <li key={`${region.x}-${region.y}-${regionIndex}`} className="font-mono text-[9px] text-muted-foreground">#{regionIndex + 1} {region.label}: x={region.x}, y={region.y}, {region.width}×{region.height}</li>)}</ul> : null}
                 {finding.category === 'komprese' && <button type="button" onClick={() => setOpenStage(1)} className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[.1em] text-primary hover:underline">{t.openMetadata}</button>}
               </div>
               <div className={`font-mono text-[10px] uppercase tracking-[.12em] md:text-right ${finding.severity === 'high' ? 'text-red-400' : finding.severity === 'medium' ? 'text-amber-400' : 'text-teal-400'}`}>
                 {finding.severity === 'high' ? t.severityHigh : finding.severity === 'medium' ? t.severityMedium : t.severityLow}
               </div>
             </div>
          ))}
        </div>
      )
    },
    {
      id: 3,
      title: t.aiReview,
      state: item.status === 'analyzing' ? 'pending' : (item.finalStatus === 'CHYBA_API' ? 'error' : (item.status === 'failed' ? 'error' : 'complete')),
      icon: Bot,
      metric: item.status === 'complete' ? (item.finalStatus === 'POTVRZENO' ? t.confirmed : item.finalStatus === 'SPORNE' ? t.disputed : item.finalStatus === 'CHYBA_API' ? t.apiError : t.inconclusive) : '',
      content: item.status === 'analyzing' ? (
        <div className="space-y-3 py-4"><div className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{t.processingNow}</div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width] duration-700" style={{ width: `${progress?.progressPercent ?? 0}%` }} /></div><div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{phaseLabel(progress?.progressPhase, t)}</span><span>{Math.round(progress?.progressPercent ?? 0)}%</span></div></div>
      ) : item.finalStatus === 'CHYBA_API' ? (
        <div data-testid="ai-api-error" className="flex flex-col gap-4 border border-red-400/30 bg-red-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
           <div className="flex gap-3">
             <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
             <div>
               <div className="text-sm font-medium text-red-200">{t.apiError}</div>
               <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{t.apiErrorKeepsFindings}</p>
             </div>
           </div>
           <Button type="button" variant="outline" size="sm" onClick={onReanalyze} disabled={reanalyzePending}><RefreshCw className={`h-3.5 w-3.5 ${reanalyzePending ? 'animate-spin' : ''}`} />{t.retryAiReview}</Button>
        </div>
      ) : (
        <div className="grid gap-px bg-border lg:grid-cols-2">
          <article data-testid="interpret-result" className="bg-card p-5">
            <div className="flex items-start gap-3"><Bot className="mt-0.5 h-4 w-4 text-primary" /><div><h4 className="text-sm font-semibold">{t.interpretAgent}</h4><p className="mt-1 text-xs text-muted-foreground">{t.interpretAgentDetail}</p></div></div>
            {item.interpretResult ? <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2"><VerdictBadge verdict={interpretVerdict} />{item.interpretResult.confidence != null && <span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">{item.interpretResult.confidence}%</span>}</div>
              <div><div className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{t.reasoning}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.interpretResult.zduvodneni || t.noItemsReported}</p></div>
              <div><div className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{t.uncertainties}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.interpretResult.nejasnosti || t.noItemsReported}</p></div>
            </div> : <p className="mt-5 text-xs text-muted-foreground">{t.noAgentResult}</p>}
          </article>
          <article data-testid="verifier-result" className="bg-card p-5">
            <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 text-primary" /><div><h4 className="text-sm font-semibold">{t.verifierAgent}</h4><p className="mt-1 text-xs text-muted-foreground">{t.verifierAgentDetail}</p></div></div>{item.verifierResult?.shoda_s_analytikem != null && <span className={`shrink-0 font-mono text-[9px] uppercase ${item.verifierResult.shoda_s_analytikem ? 'text-teal-400' : 'text-amber-400'}`}>{item.verifierResult.shoda_s_analytikem ? t.agreement : t.disagreement}</span>}</div>
            {item.verifierResult ? <div className="mt-5 space-y-5">
              <div><div className="font-mono text-[9px] uppercase tracking-[.14em] text-teal-400">{t.confirmedFindings}</div><ResultList items={item.verifierResult.potvrzena_zjisteni} emptyLabel={t.noItemsReported} tone="confirmed" /></div>
              <div><div className="font-mono text-[9px] uppercase tracking-[.14em] text-amber-400">{t.contradictions}</div><ResultList items={item.verifierResult.rozpory} emptyLabel={t.noItemsReported} tone="disputed" /></div>
              <div><div className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{t.verifierComment}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.verifierResult.komentar || t.noItemsReported}</p></div>
            </div> : <p className="mt-5 text-xs text-muted-foreground">{t.noAgentResult}</p>}
          </article>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {stages.map((stage, idx) => (
         <div key={stage.id} className="relative">
           {idx !== stages.length - 1 && (
             <div className={`absolute left-[39px] top-[60px] bottom-[-24px] w-px z-0 ${stage.state === 'complete' ? 'bg-primary/50' : 'bg-border'}`} />
           )}
           <div className={`relative z-10 overflow-hidden border transition-all duration-300 ${openStage === stage.id ? 'border-primary/40 bg-card shadow-[0_0_20px_rgba(0,0,0,0.15)]' : 'border-border bg-background hover:border-primary/20'}`}>
             <button
               type="button"
               className="flex w-full items-center justify-between p-4 focus:outline-none"
               onClick={() => setOpenStage(openStage === stage.id ? null : stage.id)}
             >
               <div className="flex items-center gap-4">
                   <div className={`flex h-12 w-12 shrink-0 items-center justify-center border bg-background transition-colors ${stage.state === 'complete' ? 'border-primary/40 text-primary' : stage.state === 'error' ? 'border-red-400/40 text-red-400' : stage.state === 'analyzing' ? 'border-primary/60 text-primary ring-2 ring-primary/20' : 'border-border text-muted-foreground'}`}>
                    <stage.icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">0{stage.id}</span>
                      <div className="text-sm font-semibold tracking-[-.02em] text-foreground">{stage.title}</div>
                    </div>
                    <div className={`font-mono text-[10px] uppercase mt-1 ${stage.state === 'error' ? 'text-red-400' : stage.state === 'analyzing' ? 'text-primary' : stage.state === 'complete' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                      {stage.state === 'analyzing' ? t.processingNow : stage.state === 'complete' ? t.complete : stage.state === 'error' ? t.failed : t.queued}
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  {stage.metric && <div className={`hidden font-mono text-xs sm:block ${stage.state === 'error' ? 'text-red-400' : stage.state === 'complete' ? 'text-foreground' : 'text-muted-foreground'}`}>{stage.metric}</div>}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${openStage === stage.id ? 'rotate-180' : ''}`} />
               </div>
             </button>
             <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${openStage === stage.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
               <div className="overflow-hidden">
                 <div className="border-t border-border bg-background/30 p-5">
                   {stage.content}
                 </div>
               </div>
             </div>
           </div>
         </div>
      ))}
    </div>
  );
}

export default function AnalysisDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const id = Number(params.id);
  const analysis = useGetAnalysis(id, { query: { queryKey: getGetAnalysisQueryKey(id), enabled: Number.isFinite(id), refetchInterval: (query) => query.state.data?.status === 'analyzing' ? 3000 : false } });
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (analysis.data?.status !== 'analyzing') return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [analysis.data?.status]);
  const objectPath = analysis.data?.objectPath ?? '';
  const reanalyze = useReanalyzeVideo();
  const deleteAnalysis = useDeleteAnalysis();
  const setManualVerdict = useSetManualVerdict();
  const originalVideoUrl = objectPath ? getStreamAnalysisSourceUrl(id) : '';
  const videoUrl = analysis.data?.mediaType === 'video' && previewFailed ? getGetAnalysisPreviewUrl(id) : originalVideoUrl;

  const evidence = useMemo(() => analysis.data?.evidence ?? [], [analysis.data?.evidence]);
  const diagnosticRegions = useMemo(() => evidence.flatMap((finding) => finding.regions ?? []), [evidence]);
  const metadata = analysis.data?.metadata ?? { container: '', codec: '', duration: 0, createdAt: null, modifiedAt: null, encoder: null, bitrate: null, frameRate: null, resolution: null, allMetadata: undefined, editingSoftware: { detected: false, name: null, source: null, rawEncoder: null, confidence: null, evidence: null } };

  const handleCopyMetadata = () => {
    if (!metadata.allMetadata) return;
    navigator.clipboard.writeText(JSON.stringify(metadata.allMetadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMetadataJson = () => {
    if (!metadata.allMetadata) return;
    const blob = new Blob([JSON.stringify(metadata.allMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${analysis.data?.name.replace(/\.[^.]+$/, '')}-metadata.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleReanalyze = () => {
    reanalyze.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        toast({ title: t.analysisQueued, description: t.analysisQueuedDetail });
      },
      onError: (error) => toast({ title: t.couldNotReanalyze, description: errorMessage(error), variant: 'destructive' }),
    });
  };

  const handleManualVerdict = (verdict: 'ORIGINAL' | 'UPRAVENO' | 'UPRAVENO_AI' | 'CELE_AI' | 'NEJISTE') => {
    setManualVerdict.mutate({ id, data: { verdict } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t.verdictSaved });
      },
      onError: (error) => toast({ title: t.couldNotSaveVerdict, description: errorMessage(error), variant: 'destructive' }),
    });
  };

  const handleDelete = () => {
    if (!analysis.data || !window.confirm(`${t.deleteAnalysis} “${analysis.data.name}”?`)) return;
    deleteAnalysis.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t.analysisRemoved });
        setLocation('/');
      },
      onError: (error) => toast({ title: t.couldNotDelete, description: errorMessage(error), variant: 'destructive' }),
    });
  };

  const seekToFinding = (seconds?: number | null) => {
    seekVideoToFinding(videoRef.current, seconds);
  };

  const stepFrame = (direction: -1 | 1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const fps = parseFrameRate(metadata.frameRate);
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + direction / fps));
  };

  const downloadReport = () => {
    if (!analysis.data?.reportHtml) {
      toast({ title: t.reportNotAvailable, description: t.reportNotAvailableDetail });
      return;
    }
    const blob = new Blob([analysis.data.reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${analysis.data.name.replace(/\.[^.]+$/, '')}-forensic-report.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (analysis.isLoading) return <ForensicsShell><TopBar eyebrow={t.evidenceLab} title={t.loadingExamination} /><div className="mx-auto max-w-[1440px] space-y-5 p-5 sm:p-8"><div className="h-28 animate-pulse border border-border bg-card" /><div className="grid gap-5 lg:grid-cols-2"><div className="h-72 animate-pulse border border-border bg-card" /><div className="h-72 animate-pulse border border-border bg-card" /></div></div></ForensicsShell>;
  if (analysis.isError || !analysis.data) return <ForensicsShell><TopBar eyebrow={t.evidenceLab} title={t.examinationUnavailable} /><div className="mx-auto max-w-2xl p-5 pt-16 sm:p-12"><EmptyState title={t.caseFileCouldNotBeOpened} detail={t.analysisMayHaveBeenRemoved} icon={<ShieldAlert className="h-5 w-5" />} /><div className="mt-5 text-center"><Link href="/" data-testid="link-back-error" className="text-sm text-primary hover:underline">{t.returnToWorkspace}</Link></div></div></ForensicsShell>;

  const item = analysis.data;
  const elapsed = item.status === 'analyzing' && item.analysisStartedAt
    ? Math.max(item.elapsedSeconds, Math.floor((clockNow - new Date(item.analysisStartedAt).getTime()) / 1000))
    : item.elapsedSeconds;

  return (
    <ForensicsShell>
      <TopBar eyebrow={`${t.evidenceLab} ${String(item.id).padStart(5, '0')}`} title={t.forensicExamination} action={<div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" data-testid="button-reanalyze" onClick={handleReanalyze} disabled={reanalyze.isPending}><RefreshCw className={`h-3.5 w-3.5 ${reanalyze.isPending ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">{t.reanalyze}</span></Button><button type="button" data-testid="button-delete-detail" onClick={handleDelete} className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>} />
      <div className="mx-auto max-w-[1440px] space-y-6 p-5 sm:p-8">
        <Link href="/" data-testid="link-back-workspace" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> {t.backToWorkspace}</Link>
        <section className="scanline border border-border bg-card p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><span className="font-mono text-[10px] text-muted-foreground">REF {String(item.id).padStart(5, '0')}</span></div><h2 data-testid="text-analysis-name" className="mt-4 break-words text-2xl font-semibold tracking-[-.045em] sm:text-4xl">{item.name}</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground"><span>{t.opened} {formatDate(item.createdAt) || t.notPresent}</span><span>{t.updated} {formatDate(item.updatedAt) || t.notPresent}</span><span>{item.evidenceCount} {item.evidenceCount === 1 ? t.evidenceItem : t.evidenceItems}</span></div></div>
            <div className="flex shrink-0 flex-col items-start gap-4 border-l-2 border-primary/40 pl-4 lg:items-end"><div className="font-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">{t.determination}</div><VerdictBadge verdict={item.verdict} large /><ConfidenceMeter value={item.confidence} large /></div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,1.2fr)_minmax(400px,2fr)] items-start">
          <div className="space-y-6">
            <section className="border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.evidenceObject}</div><h3 className="mt-1 text-base font-semibold">{item.mediaType === 'image' ? t.sourceMedia : t.sourceRecording}</h3></div>{item.mediaType === 'image' ? <FileImage className="h-5 w-5 text-muted-foreground" /> : <FileVideo className="h-5 w-5 text-muted-foreground" />}</div>
              <div className="bg-background">
                  {videoUrl ? (item.mediaType === 'image' ? <div className="relative"><img data-testid="image-source-preview" className="block h-auto w-full bg-black/40" src={getGetAnalysisPreviewUrl(id)} alt={item.name} onLoad={(event) => setImageNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /><ImageDiagnosticOverlay regions={diagnosticRegions} naturalSize={imageNaturalSize} /></div> : fallbackFailed ? <div data-testid="video-preview-fallback" className="instrument-grid flex aspect-video items-center justify-center"><div className="text-center"><HardDrive className="mx-auto h-6 w-6 text-muted-foreground" /><div className="mt-3 text-sm text-muted-foreground">{t.previewUnavailable}</div></div></div> : <><video ref={videoRef} data-testid="video-source-preview" controls preload="metadata" className="aspect-video w-full bg-black/40" src={videoUrl} onError={() => previewFailed ? setFallbackFailed(true) : setPreviewFailed(true)} /><div className="flex items-center justify-center gap-2 border-t border-border p-2"><Button type="button" variant="outline" size="sm" onClick={() => stepFrame(-1)} aria-label={lang === 'cs' ? 'Předchozí snímek' : 'Previous frame'}><SkipBack className="h-3.5 w-3.5" /> {lang === 'cs' ? 'Snímek zpět' : 'Previous frame'}</Button><Button type="button" variant="outline" size="sm" onClick={() => stepFrame(1)} aria-label={lang === 'cs' ? 'Následující snímek' : 'Next frame'}><SkipForward className="h-3.5 w-3.5" /> {lang === 'cs' ? 'Snímek vpřed' : 'Next frame'}</Button></div></>) : <div data-testid="media-source-placeholder" className="instrument-grid flex aspect-video items-center justify-center"><div className="text-center"><HardDrive className="mx-auto h-6 w-6 text-muted-foreground" /><div className="mt-3 text-sm text-muted-foreground">{t.noSourceObject}</div></div></div>}
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
                <div className="bg-card p-3"><div className="font-mono text-[9px] uppercase text-muted-foreground">{item.mediaType === 'video' ? t.duration : t.resolution}</div><div className="mt-1 font-mono text-xs">{item.mediaType === 'video' ? formatDuration(metadata.duration) : (metadata.resolution || '—')}</div></div>
                <div className="bg-card p-3"><div className="font-mono text-[9px] uppercase text-muted-foreground">{t.container}</div><div className="mt-1 font-mono text-xs">{metadata.container || '—'}</div></div>
                <div className="bg-card p-3"><div className="font-mono text-[9px] uppercase text-muted-foreground">{t.codec}</div><div className="mt-1 font-mono text-xs">{metadata.codec || '—'}</div></div>
                <div className="bg-card p-3"><div className="font-mono text-[9px] uppercase text-muted-foreground">{t.size}</div><div className="mt-1 font-mono text-xs">{t.notPresent}</div></div>
              </div>
            </section>

            <EditingSoftwareCard editingSoftware={metadata.editingSoftware} />
            <AnalysisCharts analysis={item} />

            <section className="border border-border bg-card p-5">
              <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.manualReview}</div>
              <div className="mt-1 text-base font-semibold">{t.manualVerdict}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {([
                  ['ORIGINAL', t.markAsOriginal],
                  ['UPRAVENO', t.markAsEdited],
                  ['UPRAVENO_AI', t.markAsAiModified],
                  ['CELE_AI', t.markAsEntirelyAiGenerated],
                  ['NEJISTE', t.markAsInconclusive],
                ] as const).map(([verdict, label]) => (
                  <Button key={verdict} type="button" variant={item.manualVerdict === verdict ? 'default' : 'outline'} size="sm" disabled={setManualVerdict.isPending} onClick={() => handleManualVerdict(verdict)} data-testid={`button-manual-verdict-${verdict.toLowerCase()}`}>
                    {label}
                  </Button>
                ))}
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground mt-2 block w-full">
                  {item.manualVerdict ? `${t.currentManualVerdict}: ${{ ORIGINAL: t.original, UPRAVENO: t.edited, UPRAVENO_AI: t.aiModified, CELE_AI: t.entirelyAiGenerated, NEJISTE: t.inconclusive }[item.manualVerdict]}` : t.noManualVerdict}
                </span>
              </div>
            </section>

             <section className="border border-border bg-card p-5">
               <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">AI usage / Náklady</div>
               <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                 {([
                   ['Interpret', item.aiUsage?.interpretInputTokens, item.aiUsage?.interpretOutputTokens, item.aiUsage?.interpretCostUsd],
                   ['Verifier', item.aiUsage?.verifierInputTokens, item.aiUsage?.verifierOutputTokens, item.aiUsage?.verifierCostUsd],
                 ] as const).map(([label, input, output, cost]) => (
                   <div key={label} className="border border-border p-3">
                     <div className="font-medium">{label}</div>
                     <div className="mt-1 font-mono text-muted-foreground">in {input ?? '—'} · out {output ?? '—'}</div>
                     <div className="mt-1 font-mono text-primary">{cost == null ? '—' : `$${Number(cost).toFixed(6)}`}</div>
                   </div>
                 ))}
               </div>
             </section>

            <section className="border border-border bg-card p-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-primary"><Terminal className="h-3.5 w-3.5" /> {t.interpretationBoundary}</div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.reportPresents}</p>
            </section>

            {item.reportHtml && (
              <section className="border border-border bg-card p-5">
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.reportStatus}</div>
                <div className="mt-3 flex items-center gap-2 text-sm text-teal-400"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> {t.htmlReportReady}</div>
                <iframe data-testid="iframe-report-preview" title="Forensic report preview" sandbox="allow-scripts" srcDoc={item.reportHtml} className="mt-4 h-40 w-full border border-border bg-background" />
                <button type="button" data-testid="button-download-report-secondary" onClick={downloadReport} className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground hover:text-primary"><Download className="h-3.5 w-3.5" /> {t.downloadCaseReport}</button>
              </section>
            )}
          </div>

          <div className="space-y-0">
             <div className="mb-6 font-mono text-[10px] uppercase tracking-[.2em] text-primary">Pipeline / Průběh analýzy</div>
             <ForensicPipeline
               item={item}
               metadata={metadata}
               evidence={evidence}
               seekToFinding={seekToFinding}
               onReanalyze={handleReanalyze}
               reanalyzePending={reanalyze.isPending}
               t={t}
               copied={copied}
               handleCopyMetadata={handleCopyMetadata}
               downloadMetadataJson={downloadMetadataJson}
                progress={item}
                elapsed={elapsed}
             />
          </div>
        </div>
      </div>
    </ForensicsShell>
  );
}