import { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/use-language';
import { ForensicsShell, TopBar, VerdictBadge, StatusBadge } from '@/components/forensics-ui';
import { useListAnalyses, useGetAnalysis, getGetAnalysisQueryKey } from '@workspace/api-client-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, ShieldAlert, FileVideo, Image as ImageIcon, CheckCircle2, AlertTriangle, FileSearch } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

function ResultList({ items, emptyLabel, tone }: { items?: string[]; emptyLabel: string; tone: 'confirmed' | 'disputed' }) {
  if (!items?.length) return <p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="mt-2 space-y-2">
      {items.map((text, index) => (
        <li key={`${text}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'confirmed' ? 'bg-teal-400' : 'bg-amber-400'}`} />
          {text}
        </li>
      ))}
    </ul>
  );
}

export default function AgentsPage() {
  const { t } = useLanguage();
  const { data: analyses } = useListAnalyses();
  
  const completedAnalyses = useMemo(() => {
    return analyses?.filter(a => a.status === 'complete') || [];
  }, [analyses]);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  
  const analysis = useGetAnalysis(selectedAnalysisId!, { 
    query: { 
      queryKey: getGetAnalysisQueryKey(selectedAnalysisId!), 
      enabled: selectedAnalysisId !== null 
    } 
  });

  const item = analysis.data;

  const interpretVerdict = item?.interpretResult?.verdict === 'ORIGINAL'
    ? 'ORIGINÁL'
    : item?.interpretResult?.verdict === 'UPRAVENO'
      ? 'UPRAVENO'
      : item?.interpretResult?.verdict === 'UPRAVENO_AI'
        ? 'UPRAVENO_AI'
        : item?.interpretResult?.verdict === 'CELE_AI'
          ? 'CELE_AI'
          : 'NEURČENO';

  return (
    <ForensicsShell>
      <div className="flex h-[100dvh] flex-col">
        <TopBar 
          eyebrow={t.agentsWorkspace} 
          title={t.inspectAgentExchange} 
        />
        
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Sidebar (Selection) */}
          <div className="w-[320px] shrink-0 flex flex-col border-r border-border bg-sidebar overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">{t.settings}</h3>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-6">
                <div className="space-y-3">
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">{t.sourceMedia}</Label>
                  <Select value={selectedAnalysisId?.toString() || ''} onValueChange={v => setSelectedAnalysisId(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t.selectAnalysis} />
                    </SelectTrigger>
                    <SelectContent>
                      {completedAnalyses.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          <div className="flex items-center gap-2">
                            {a.mediaType === 'image' ? <ImageIcon className="h-3 w-3 opacity-70" /> : <FileVideo className="h-3 w-3 opacity-70" />}
                            <span className="truncate max-w-[200px]">{a.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {item && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">{t.fileReference}</div>
                      <div className="mt-1 text-sm font-medium break-all">{item.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-1">REF {String(item.id).padStart(5, '0')}</div>
                    </div>
                    
                    <div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1.5">{t.status}</div>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Workspace (Agent logs) */}
          <div className="flex flex-1 flex-col bg-background">
            <ScrollArea className="flex-1">
              <div className="max-w-4xl mx-auto p-8 space-y-8">
                
                {!selectedAnalysisId ? (
                  <div className="instrument-grid flex min-h-[400px] flex-col items-center justify-center border border-dashed border-border px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                      <FileSearch className="h-8 w-8 opacity-80" />
                    </div>
                    <h3 className="text-base font-medium">{t.selectAnalysis}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{t.inspectAgentExchange}</p>
                  </div>
                ) : analysis.isLoading ? (
                  <div className="py-20 text-center font-mono text-sm text-muted-foreground animate-pulse">
                    Loading agent logs...
                  </div>
                ) : item?.finalStatus === 'CHYBA_API' ? (
                   <div className="flex flex-col gap-4 border border-red-400/30 bg-red-400/5 p-6 text-center">
                     <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
                     <div className="text-base font-medium text-red-200">{t.apiError}</div>
                     <p className="text-sm text-muted-foreground max-w-md mx-auto">{t.apiErrorKeepsFindings}</p>
                   </div>
                ) : item ? (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary mb-6 border-b border-border pb-2">
                      {t.agentExchange}
                    </div>

                    <section className="border border-border bg-card p-5">
                      <div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">{t.agentEvidenceSteps}</div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.agentEvidenceStepsDetail}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {item.pipelineSteps.map((step) => (
                          <div key={step.stepName} className="flex items-center justify-between gap-3 border border-border bg-background/50 px-3 py-2">
                            <span className="font-mono text-[10px] uppercase text-foreground">{step.stepName}</span>
                            <span className={`font-mono text-[9px] uppercase ${step.stepStatus === 'OK' ? 'text-teal-400' : step.stepStatus === 'CHYBA' ? 'text-red-400' : 'text-amber-400'}`}>
                              {step.stepStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    {/* Interpret Agent Block */}
                    <article className="relative overflow-hidden border border-border bg-card shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary/50">
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/5 text-primary">
                            <Bot className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
                              <div>
                                <h4 className="text-lg font-semibold">{t.interpretAgent}</h4>
                                <p className="mt-1 text-xs text-muted-foreground">{t.interpretAgentDetail}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.interpretResult?.confidence != null && (
                                  <span className="font-mono text-xs font-medium text-primary">
                                    {t.confidenceScore}: {item.interpretResult.confidence}%
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {item.interpretResult ? (
                              <div className="mt-6 space-y-6">
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground mb-2">Verdict</div>
                                  <VerdictBadge verdict={interpretVerdict} />
                                </div>
                                
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground mb-2">{t.reasoning}</div>
                                  <div className="rounded border border-border bg-background/50 p-4">
                                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                      {item.interpretResult.zduvodneni || t.noItemsReported}
                                    </p>
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground mb-2">{t.uncertainties}</div>
                                  <div className="rounded border border-border bg-background/50 p-4">
                                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                      {item.interpretResult.nejasnosti || t.noItemsReported}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-6 text-sm text-muted-foreground">{t.noAgentResult}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>

                    {/* Verifier Agent Block */}
                    <article className="relative overflow-hidden border border-border bg-card shadow-sm before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-accent/50">
                      <div className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 items-center justify-center border border-accent/20 bg-accent/5 text-accent">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
                              <div>
                                <h4 className="text-lg font-semibold">{t.verifierAgent}</h4>
                                <p className="mt-1 text-xs text-muted-foreground">{t.verifierAgentDetail}</p>
                              </div>
                              {item.verifierResult?.shoda_s_analytikem != null && (
                                <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm font-mono text-xs uppercase ${item.verifierResult.shoda_s_analytikem ? 'border-teal-500/30 bg-teal-500/10 text-teal-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
                                  {item.verifierResult.shoda_s_analytikem ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                  {item.verifierResult.shoda_s_analytikem ? t.agreement : t.disagreement}
                                </div>
                              )}
                            </div>
                            
                            {item.verifierResult ? (
                              <div className="mt-6 space-y-6">
                                <div className="grid sm:grid-cols-2 gap-6">
                                  <div className="rounded border border-teal-500/20 bg-teal-500/5 p-4">
                                    <div className="font-mono text-[10px] uppercase tracking-[.14em] text-teal-400 mb-2">{t.confirmedFindings}</div>
                                    <ResultList items={item.verifierResult.potvrzena_zjisteni} emptyLabel={t.noItemsReported} tone="confirmed" />
                                  </div>
                                  
                                  <div className="rounded border border-amber-500/20 bg-amber-500/5 p-4">
                                    <div className="font-mono text-[10px] uppercase tracking-[.14em] text-amber-400 mb-2">{t.contradictions}</div>
                                    <ResultList items={item.verifierResult.rozpory} emptyLabel={t.noItemsReported} tone="disputed" />
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground mb-2">{t.verifierComment}</div>
                                  <div className="rounded border border-border bg-background/50 p-4">
                                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                      {item.verifierResult.komentar || t.noItemsReported}
                                    </p>
                                  </div>
                                </div>
                                
                                <div>
                                  <div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground mb-2">{t.finalVerifierStatus}</div>
                                  <div className="inline-flex px-3 py-1.5 border border-border bg-background font-mono text-xs font-semibold">
                                    {item.finalStatus === 'POTVRZENO' ? t.confirmed : item.finalStatus === 'SPORNE' ? t.disputed : t.inconclusive}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-6 text-sm text-muted-foreground">{t.noAgentResult}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  </>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </ForensicsShell>
  );
}
