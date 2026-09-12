import { useMemo } from 'react';
import { Database, FileVideo } from 'lucide-react';
import { getGetAnalysisQueryKey, useGetAnalysis, useListAnalyses } from '@workspace/api-client-react';
import { EmptyState, ForensicsShell, TopBar } from '@/components/forensics-ui';
import { useLanguage } from '@/lib/use-language';

function MetadataField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-foreground">{value ?? '—'}</div>
    </div>
  );
}

export default function MetadataPage() {
  const { t } = useLanguage();
  const list = useListAnalyses();
  const latestVideo = useMemo(() => {
    return [...(list.data ?? [])]
      .filter((analysis) => analysis.mediaType === 'video' && analysis.status === 'complete')
      .sort((left, right) => {
        const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return Number.isFinite(byDate) && byDate !== 0 ? byDate : right.id - left.id;
      })[0];
  }, [list.data]);

  const analysis = useGetAnalysis(latestVideo?.id ?? 0, {
    query: {
      queryKey: getGetAnalysisQueryKey(latestVideo?.id ?? 0),
      enabled: Boolean(latestVideo),
    },
  });

  const item = analysis.data;
  const metadata = item?.metadata;

  return (
    <ForensicsShell>
      <TopBar eyebrow={t.metadataWorkspace} title={t.latestVideoMetadata} />
      <div className="mx-auto max-w-[1280px] space-y-6 p-5 sm:p-8">
        {list.isLoading || analysis.isLoading ? (
          <div className="h-48 animate-pulse border border-border bg-card" />
        ) : !latestVideo || !item ? (
          <EmptyState title={t.noCompletedVideo} detail={t.noSourceObject} icon={<Database className="h-5 w-5" />} />
        ) : (
          <>
            <section className="border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
                  <FileVideo className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-[.2em] text-primary">REF {String(item.id).padStart(5, '0')}</div>
                  <h2 className="mt-1 break-words text-xl font-semibold">{item.name}</h2>
                  <div className="mt-2 font-mono text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetadataField label={t.container} value={metadata?.container} />
              <MetadataField label={t.codec} value={metadata?.codec} />
              <MetadataField label={t.duration} value={metadata?.duration != null ? `${metadata.duration} s` : null} />
              <MetadataField label={t.resolution} value={metadata?.resolution} />
              <MetadataField label="FPS" value={metadata?.frameRate} />
              <MetadataField label="Bitrate" value={metadata?.bitrate} />
              <MetadataField label="Encoder" value={metadata?.encoder} />
              <MetadataField label={t.detectedSoftware} value={metadata?.editingSoftware?.name} />
            </section>

            <section className="border border-border bg-card">
              <div className="border-b border-border px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.metadataWorkspace} JSON</div>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-all p-5 font-mono text-[11px] leading-5 text-muted-foreground">
                {JSON.stringify(metadata?.allMetadata ?? metadata ?? {}, null, 2)}
              </pre>
            </section>
          </>
        )}
      </div>
    </ForensicsShell>
  );
}