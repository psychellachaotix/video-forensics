import { AlertTriangle, Check, ChevronRight, Database, FileSearch, FileVideo, Image as ImageIcon, LoaderCircle, Radio, Scissors, ShieldCheck, XCircle, Users, ImagePlus } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { ReactNode } from 'react';
import type { Analysis, AnalysisStatus, AnalysisVerdict } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/use-language';

export function ForensicsShell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useLanguage();
  const [location] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border px-6">
          <div className="relative flex h-8 w-8 items-center justify-center border border-primary/70 text-primary">
            <span className="absolute h-2 w-2 bg-primary" />
            <span className="absolute h-5 w-5 border border-primary/40" />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[.16em] text-foreground">VIDEO</div>
            <div className="font-mono text-[10px] tracking-[.24em] text-primary">FORENSICS</div>
          </div>
        </div>
        <div className="px-4 pt-8">
          <div className="mb-3 px-2 font-mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">{t.workspace}</div>
          <div className="space-y-1">
            <Link href="/" data-testid="link-workspace" className={`group flex items-center justify-between border px-3 py-3 text-sm transition-colors ${location === '/' || location.startsWith('/analysis/') ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20' : 'border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-primary'}`}>
              <span className="flex items-center gap-3"><Radio className="h-4 w-4" /> {t.analysisWorkspace}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/editor" data-testid="link-editor" className={`group flex items-center justify-between border px-3 py-3 text-sm transition-colors ${location === '/editor' ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20' : 'border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-primary'}`}>
              <span className="flex items-center gap-3"><Scissors className="h-4 w-4" /> {t.editorWorkspace}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/photo-editor" data-testid="link-photo-editor" className={`group flex items-center justify-between border px-3 py-3 text-sm transition-colors ${location === '/photo-editor' ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20' : 'border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-primary'}`}>
              <span className="flex items-center gap-3"><ImagePlus className="h-4 w-4" /> {t.photoEditorWorkspace}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/agents" data-testid="link-agents" className={`group flex items-center justify-between border px-3 py-3 text-sm transition-colors ${location === '/agents' ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20' : 'border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-primary'}`}>
              <span className="flex items-center gap-3"><Users className="h-4 w-4" /> {t.agentsWorkspace}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/metadata" data-testid="link-metadata" className={`group flex items-center justify-between border px-3 py-3 text-sm transition-colors ${location === '/metadata' ? 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20' : 'border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-primary'}`}>
              <span className="flex items-center gap-3"><Database className="h-4 w-4" /> {t.metadataWorkspace}</span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <div className="mt-auto border-t border-sidebar-border px-6 py-5">
          <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">
            <button type="button" data-testid="button-lang-cs" onClick={() => setLang('cs')} className={`hover:text-primary ${lang === 'cs' ? 'text-primary' : ''}`}>CS</button>
            <span className="opacity-30">/</span>
            <button type="button" data-testid="button-lang-en" onClick={() => setLang('en')} className={`hover:text-primary ${lang === 'en' ? 'text-primary' : ''}`}>EN</button>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" /> {t.instrumentOnline}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground/70">LOCAL / EVIDENCE LAB 01</div>
        </div>
      </aside>
      <main className="min-h-[100dvh] lg:pl-[232px]">{children}</main>
    </div>
  );
}

export function TopBar({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <header className="flex min-h-[72px] items-center justify-between border-b border-border px-5 py-4 sm:px-8">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">{eyebrow}</div>
        <h1 className="mt-1 text-xl font-semibold tracking-[-.03em] sm:text-2xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function StatusBadge({ status }: { status: AnalysisStatus }) {
  const { t } = useLanguage();
  const map: Record<AnalysisStatus, { label: string; className: string; icon: ReactNode }> = {
    queued: { label: t.queued, className: 'border-amber-400/30 bg-amber-400/10 text-amber-400', icon: <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> },
    analyzing: { label: t.analyzing, className: 'border-primary/30 bg-primary/10 text-primary', icon: <LoaderCircle className="h-3 w-3 animate-spin" /> },
    complete: { label: t.complete, className: 'border-teal-400/30 bg-teal-400/10 text-teal-400', icon: <Check className="h-3 w-3" /> },
    failed: { label: t.failed, className: 'border-destructive/40 bg-destructive/10 text-red-400', icon: <XCircle className="h-3 w-3" /> },
  };
  const item = map[status];
  return <span data-testid={`status-analysis-${status}`} className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[.1em] ${item.className}`}>{item.icon}{item.label}</span>;
}

export function VerdictBadge({ verdict, large = false }: { verdict: AnalysisVerdict; large?: boolean }) {
  const { t } = useLanguage();
  const map: Record<AnalysisVerdict, { className: string; icon: ReactNode; descriptor: string }> = {
    ORIGINÁL: { className: 'border-teal-400/35 bg-teal-400/10 text-teal-400', icon: <ShieldCheck className="h-4 w-4" />, descriptor: t.noEditIndicatorsDetected },
    UPRAVENO: { className: 'border-amber-400/35 bg-amber-400/10 text-amber-400', icon: <AlertTriangle className="h-4 w-4" />, descriptor: t.editIndicatorsDetected },
    UPRAVENO_AI: { className: 'border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-400', icon: <AlertTriangle className="h-4 w-4" />, descriptor: t.aiModified },
    CELE_AI: { className: 'border-purple-400/35 bg-purple-400/10 text-purple-400', icon: <AlertTriangle className="h-4 w-4" />, descriptor: t.entirelyAiGenerated },
    NEURČENO: { className: 'border-muted-foreground/35 bg-muted/50 text-muted-foreground', icon: <Radio className="h-4 w-4" />, descriptor: t.evidenceInconclusive },
  };
  const item = map[verdict];
  const labels: Record<AnalysisVerdict, string> = { ORIGINÁL: t.original, UPRAVENO: t.edited, UPRAVENO_AI: t.aiModified, CELE_AI: t.entirelyAiGenerated, NEURČENO: t.inconclusive };
  return <div data-testid={`verdict-${verdict}`} className={`inline-flex items-center gap-2 border ${large ? 'px-4 py-2.5' : 'px-2 py-1'} ${item.className}`}><span>{item.icon}</span><span className={`${large ? 'text-base' : 'text-[10px]'} font-semibold tracking-[.08em]`}>{labels[verdict]}</span></div>;
}

export function ConfidenceMeter({ value, large = false }: { value: number; large?: boolean }) {
  const { t } = useLanguage();
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div data-testid="meter-confidence" className={large ? 'w-full' : 'w-28'}>
      <div className="mb-1.5 flex items-end justify-between gap-3"><span className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">{t.confidence}</span><span className={`${large ? 'text-2xl' : 'text-sm'} font-semibold text-primary`}>{safe.toFixed(1)}%</span></div>
      <div className={`${large ? 'h-2' : 'h-1.5'} overflow-hidden bg-muted`}><div className="h-full bg-primary transition-all duration-500" style={{ width: `${safe}%` }} /></div>
    </div>
  );
}

export function StatCard({ label, value, detail, accent = false }: { label: string; value: string | number; detail?: string; accent?: boolean }) {
  return <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className={`border border-border bg-card p-4 ${accent ? 'border-primary/30' : ''}`}><div className="font-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">{label}</div><div className={`mt-2 text-3xl font-semibold tracking-[-.06em] ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</div>{detail && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{detail}</div>}</div>;
}

export function EmptyState({ title, detail, icon = <FileSearch className="h-5 w-5" /> }: { title: string; detail: string; icon?: ReactNode }) {
  return <div data-testid="empty-state" className="instrument-grid flex min-h-[210px] flex-col items-center justify-center border border-dashed border-border px-6 text-center"><div className="mb-4 flex h-11 w-11 items-center justify-center border border-primary/30 bg-primary/10 text-primary">{icon}</div><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

export function AnalysisRow({ analysis, onDelete }: { analysis: Analysis; onDelete: (analysis: Analysis) => void }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const handleRowClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.tagName.toLowerCase() === 'button') return;
    setLocation(`/analysis/${analysis.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.tagName.toLowerCase() === 'button') return;
      e.preventDefault();
      handleRowClick(e);
    }
  };

  return <div tabIndex={0} role="button" onClick={handleRowClick} onKeyDown={handleKeyDown} data-testid={`row-analysis-${analysis.id}`} className="group grid grid-cols-[1fr_auto] gap-4 border-b border-border px-4 py-4 transition-colors hover:bg-primary/[.035] cursor-pointer sm:grid-cols-[minmax(240px,1.6fr)_110px_110px_120px_34px] sm:items-center focus-visible:outline-none focus-visible:bg-primary/[.05] focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset">
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground group-hover:border-primary/40 group-hover:text-primary transition-colors">
          {analysis.mediaType === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <FileVideo className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium group-hover:text-primary transition-colors">{analysis.name}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">REF {String(analysis.id).padStart(5, '0')}</div>
        </div>
      </div>
    </div>
    <div className="hidden sm:block"><StatusBadge status={analysis.status} /></div>
    <div className="hidden sm:block"><VerdictBadge verdict={analysis.verdict} /></div>
    <div className="hidden sm:block"><ConfidenceMeter value={analysis.confidence} /></div>
    <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(analysis); }} aria-label={t.deleteAnalysis} data-testid={`button-delete-analysis-${analysis.id}`} className="relative z-10 flex h-8 w-8 items-center justify-center text-muted-foreground opacity-60 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"><XCircle className="h-4 w-4" /></button>
    <div className="col-span-2 flex items-center gap-2 sm:hidden"><StatusBadge status={analysis.status} /><VerdictBadge verdict={analysis.verdict} /><span className="ml-auto font-mono text-[10px] text-primary">{analysis.confidence.toFixed(1)}%</span></div>
  </div>;
}

export function LoadingRows() {
  return <div className="space-y-px">{[1, 2, 3, 4].map((n) => <div key={n} className="flex items-center gap-4 border-b border-border px-4 py-5"><div className="h-8 w-8 animate-pulse bg-muted" /><div className="h-3 w-2/5 animate-pulse bg-muted" /><div className="ml-auto h-3 w-20 animate-pulse bg-muted" /></div>)}</div>;
}
