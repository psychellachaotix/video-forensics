import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowUpRight, FilePlus2, RefreshCw, UploadCloud, ShieldAlert } from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetDashboardSummaryQueryKey,
  getGetAiProviderStatusQueryKey,
  getListAnalysesQueryKey,
  useCreateAnalysis,
  useDeleteAnalysis,
  useGetDashboardSummary,
  useGetAiProviderStatus,
  useListAnalyses,
  useRequestUploadUrl,
  useSetManualVerdict,
  type Analysis,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AnalysisRow, EmptyState, ForensicsShell, LoadingRows, StatCard, TopBar } from '@/components/forensics-ui';
import { useLanguage } from '@/lib/use-language';

type UploadItem = { key: string; file: File; state: 'waiting' | 'uploading' | 'creating' | 'complete' | 'failed'; progress: number; error?: string };

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'error' in error) return String((error as { error: unknown }).error);
  return 'The operation could not be completed.';
}

function putToSignedUrl(url: string, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Storage returned ${request.status}.`));
    request.onerror = () => reject(new Error('Could not reach object storage.'));
    request.send(file);
  });
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dashboard = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchInterval: 3_000,
    },
  });
  const analyses = useListAnalyses({
    query: {
      queryKey: getListAnalysesQueryKey(),
      refetchInterval: 3_000,
    },
  });
  const requestUrl = useRequestUploadUrl();
  const createAnalysis = useCreateAnalysis();
  const deleteAnalysis = useDeleteAnalysis();
  const setManualVerdict = useSetManualVerdict();
  const summary = dashboard.data;
  const aiStatus = useGetAiProviderStatus({ query: { queryKey: getGetAiProviderStatusQueryKey(), refetchInterval: 15_000 } });
  const rows = useMemo(() => analyses.data ?? summary?.recent ?? [], [analyses.data, summary?.recent]);
  
  const manualReviewRows = rows.filter(a => a.finalStatus === 'SPORNE' || a.finalStatus === 'NEJISTE');

  const addFiles = (files: File[]) => {
    const accepted: File[] = [];
    for (const file of files) {
      if (!/\.(mp4|mov|mkv|avi|jpg|jpeg|png|webp)$/i.test(file.name)) {
        toast({ title: t.unsupportedFormat, description: t.onlyMp4MovAviMkv, variant: 'destructive' });
        continue;
      }
      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast({ title: t.fileTooLarge, description: t.maxSizeIs2GB, variant: 'destructive' });
        continue;
      }
      accepted.push(file);
    }
    
    if (!accepted.length) {
      if (files.length) {
        toast({ title: t.noVideoSelected, description: t.chooseSupported });
      }
      return;
    }
    setQueue((current) => [...current, ...accepted.map((file) => ({ key: `${file.name}-${file.lastModified}-${file.size}`, file, state: 'waiting' as const, progress: 0 }))]);
  };

  const updateQueue = (key: string, patch: Partial<UploadItem>) => setQueue((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));

  const processFile = async (item: UploadItem) => {
    try {
      updateQueue(item.key, { state: 'uploading', progress: 1 });
      const uploaded = await requestUrl.mutateAsync({ data: { name: item.file.name, size: item.file.size, contentType: item.file.type || 'application/octet-stream' } });
      await putToSignedUrl(uploaded.uploadURL, item.file, (progress) => updateQueue(item.key, { progress }));
      updateQueue(item.key, { state: 'creating', progress: 100 });
      const fileHash = await computeFileHash(item.file);
      await createAnalysis.mutateAsync({ data: { name: item.file.name, objectPath: uploaded.objectPath, size: item.file.size, contentType: item.file.type || 'application/octet-stream', fileHash } });
      updateQueue(item.key, { state: 'complete', progress: 100 });
    } catch (error) {
      const message = errorMessage(error);
      updateQueue(item.key, { state: 'failed', error: message });
      toast({ title: `${t.uploadFailed}: ${item.file.name}`, description: message, variant: 'destructive' });
    }
  };

  const startUploads = async () => {
    const waiting = queue.filter((item) => item.state === 'waiting' || item.state === 'failed');
    for (const item of waiting) await processFile(item);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
    ]);
  };

  const removeAnalysis = (analysis: Analysis) => {
    if (!window.confirm(`${t.deleteAnalysis} “${analysis.name}”?`)) return;
    deleteAnalysis.mutate({ id: analysis.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t.analysisRemoved, description: analysis.name });
      },
      onError: (error) => toast({ title: t.couldNotDelete, description: errorMessage(error), variant: 'destructive' }),
    });
  };
  
  const handleManualVerdict = (id: number, verdict: 'ORIGINAL' | 'UPRAVENO' | 'UPRAVENO_AI' | 'CELE_AI' | 'NEJISTE') => {
    setManualVerdict.mutate({ id, data: { verdict } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: t.verdictSaved });
      },
      onError: (error) => toast({ title: t.couldNotSaveVerdict, description: errorMessage(error), variant: 'destructive' }),
    });
  };

  const isUploading = queue.some((item) => item.state === 'uploading' || item.state === 'creating');
  return (
    <ForensicsShell>
      <TopBar eyebrow={t.evidenceLab} title={t.analysisWorkspace} action={<div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground sm:flex"><Activity className="h-3.5 w-3.5 text-primary" /> {t.liveIndex}</div>} />
      <div className="mx-auto max-w-[1440px] space-y-8 p-5 sm:p-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard label={t.totalExaminations} value={summary?.total ?? '—'} detail={t.allCaseFiles} />
          <StatCard label={t.original} value={summary?.originals ?? '—'} detail={t.noEditIndicators} accent />
          <StatCard label={t.edited} value={summary?.edited ?? '—'} detail={t.editIndicatorsFound} />
          <StatCard label={t.inAnalysis} value={summary?.analyzing ?? '—'} detail={t.processingNow} />
          <StatCard label={t.needsReview} value={summary?.needsReview ?? '—'} detail={t.casesToReview} />
          <StatCard label={t.meanConfidence} value={summary ? `${summary.averageConfidence.toFixed(1)}%` : '—'} detail={t.acrossCompleted} />
          <StatCard label={t.monthlyCost} value={summary ? `$${summary.monthlyCostUsd.toFixed(2)}` : '—'} detail={t.costCurrentMonth} />
        </section>

        {aiStatus.data && (
          <section className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.aiCapability}</div><h2 className="mt-1 text-lg font-semibold">{aiStatus.data.provider} / {aiStatus.data.model}</h2></div>
              <div className="font-mono text-xs uppercase text-muted-foreground">{aiStatus.data.state} · {aiStatus.data.creditStatus}</div>
            </div>
            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
              {([['interpret', t.interpret, aiStatus.data.costEstimate.interpret], ['verifier', t.verifier, aiStatus.data.costEstimate.verifier], ['total', t.total, aiStatus.data.costEstimate.total]] as const).map(([key, label, estimate]) => (
                <div key={key} className="border border-border p-3"><div className="font-medium">{label}</div><div className="mt-1 font-mono text-muted-foreground">{estimate.inputTokens.low}–{estimate.inputTokens.high} in / {estimate.outputTokens.low}–{estimate.outputTokens.high} out</div><div className="mt-1 font-mono text-primary">${estimate.usd.low.toFixed(4)}–${estimate.usd.high.toFixed(4)}</div></div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{t.aiEstimateDisclaimer}</p>
          </section>
        )}

        {manualReviewRows.length > 0 && (
          <section className="border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold tracking-[-.03em]">{t.manualReview}</h2>
                <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">{t.casesNeedingReview}</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {manualReviewRows.map(analysis => (
                <div key={analysis.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">{analysis.name}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">REF {String(analysis.id).padStart(5, '0')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleManualVerdict(analysis.id, 'ORIGINAL')}>{t.markAsOriginal}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleManualVerdict(analysis.id, 'UPRAVENO')}>{t.markAsEdited}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleManualVerdict(analysis.id, 'UPRAVENO_AI')}>{t.markAsAiModified}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleManualVerdict(analysis.id, 'CELE_AI')}>{t.markAsEntirelyAiGenerated}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleManualVerdict(analysis.id, 'NEJISTE')}>{t.markAsInconclusive}</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
          <div className="scanline instrument-grid border border-primary/25 bg-card p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.intake}</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{t.examineRecording}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{t.uploadSourceFiles}</p></div>
              <div className="hidden h-10 w-10 items-center justify-center border border-primary/30 text-primary sm:flex"><UploadCloud className="h-5 w-5" /></div>
            </div>
            <button type="button" data-testid="button-upload-dropzone" onClick={() => fileRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={`mt-7 flex min-h-[150px] w-full flex-col items-center justify-center border border-dashed px-5 text-center transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/60 hover:bg-primary/[.04]'}`}>
              <div className="flex h-10 w-10 items-center justify-center border border-border bg-card text-primary"><FilePlus2 className="h-5 w-5" /></div>
              <div className="mt-3 text-sm font-medium">{t.dropFiles}<span className="text-primary">{t.browse}</span></div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">{t.supportedFormats}</div>
            </button>
            <input ref={fileRef} type="file" accept=".mp4,.mov,.mkv,.avi,.jpg,.jpeg,.png,.webp" multiple className="hidden" data-testid="input-video-files" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ''; }} />
            {queue.length > 0 && <div className="mt-5 space-y-2">{queue.map((item) => <div key={item.key} data-testid={`upload-item-${item.key}`} className="border border-border bg-background/70 p-3"><div className="flex items-center gap-3"><FilePlus2 className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-xs">{item.file.name}</span><span className={`font-mono text-[10px] uppercase ${item.state === 'failed' ? 'text-destructive' : item.state === 'complete' ? 'text-teal-200' : 'text-muted-foreground'}`}>{item.state === 'creating' ? t.indexing : item.state === 'waiting' ? t.queued : item.state === 'uploading' ? t.indexing : item.state === 'complete' ? t.complete : t.failed}</span>{item.state === 'failed' && <button type="button" data-testid={`button-retry-upload-${item.key}`} onClick={() => processFile(item)} className="text-primary"><RefreshCw className="h-3.5 w-3.5" /></button>}</div>{(item.state === 'uploading' || item.state === 'creating') && <div className="mt-2 h-1 bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} /></div>}{item.error && <div className="mt-2 text-[11px] text-destructive">{item.error}</div>}</div>)}</div>}
            {queue.some((item) => item.state === 'waiting' || item.state === 'failed') && <div className="mt-5 flex justify-end"><Button type="button" data-testid="button-start-upload" onClick={startUploads} disabled={isUploading}><UploadCloud className="h-4 w-4" /> {isUploading ? t.processingEvidence : `${t.beginIntake} (${queue.filter((item) => item.state === 'waiting' || item.state === 'failed').length})`}</Button></div>}
          </div>
          <div className="border border-border bg-card p-5 sm:p-7">
            <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.method}</div>
            <h2 className="mt-2 text-lg font-semibold tracking-[-.03em]">{t.whatWorkspaceRecords}</h2>
            <div className="mt-6 space-y-5">
              {[[t.containerCodecTitle, t.containerCodecDetail], [t.timelineIntegrityTitle, t.timelineIntegrityDetail], [t.evidenceLedgerTitle, t.evidenceLedgerDetail]].map(([title, detail], index) => <div key={title} className="flex gap-3"><div className="font-mono text-[10px] text-primary">0{index + 1}</div><div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></div>)}
            </div>
            <div className="mt-7 border-t border-border pt-5 font-mono text-[10px] leading-5 text-muted-foreground">{t.interpretationLimited}</div>
          </div>
        </section>

        <section className="border border-border bg-card">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 py-5 sm:px-5"><div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.caseFiles}</div><h2 className="mt-1 text-lg font-semibold tracking-[-.03em]">{t.recentAnalyses}</h2></div><Link href="/" data-testid="link-refresh-analyses" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground hover:text-primary">{t.indexView} <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
          <div className="hidden grid-cols-[minmax(240px,1.6fr)_110px_110px_120px_34px] gap-4 border-b border-border px-4 py-3 font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground sm:grid"><div>{t.fileReference}</div><div>{t.status}</div><div>{t.verdict}</div><div>{t.confidence}</div><div /></div>
          {analyses.isLoading && <LoadingRows />}
          {analyses.isError && <div className="p-6 text-sm text-destructive">{t.caseIndexFailed} <button type="button" data-testid="button-retry-analyses" onClick={() => analyses.refetch()} className="underline">{t.retry}</button></div>}
          {!analyses.isLoading && !analyses.isError && rows.length === 0 && <div className="p-4"><EmptyState title={t.noExaminationsYet} detail={t.uploadVideoAbove} /></div>}
          {!analyses.isLoading && !analyses.isError && rows.map((analysis) => <AnalysisRow key={analysis.id} analysis={analysis} onDelete={removeAnalysis} />)}
        </section>
      </div>
    </ForensicsShell>
  );
}
