import { useState, useMemo, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/use-language';
import { ForensicsShell, TopBar } from '@/components/forensics-ui';
import { getGetAnalysisPreviewUrl, getListAnalysesQueryKey, useListAnalyses, useGetAnalysis, getGetAnalysisQueryKey } from '@workspace/api-client-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, HardDrive, FileImage, CheckCircle2, Copy, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { MediaDropUpload } from '@/components/media-drop-upload';
import { useToast } from '@/hooks/use-toast';
import { EditorState, defaultEditorState } from '@/components/photo-editor-types';
import { PhotoEditorControls } from '@/components/photo-editor-controls';
import { drawToCanvas } from '@/components/photo-editor-utils';

function useImageLoader(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setImage(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setError(null);
      setLoading(false);
    };
    img.onerror = () => {
      setError(new Error('Failed to load image'));
      setLoading(false);
    };
    img.src = url;
  }, [url]);

  return { image, error, loading };
}

export default function PhotoEditorPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: analyses } = useListAnalyses({ query: { queryKey: getListAnalysesQueryKey(), refetchInterval: 3_000 } });

  const imageAnalyses = useMemo(() => {
    return analyses?.filter(a => a.mediaType === 'image' && a.status !== 'failed') || [];
  }, [analyses]);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);

  const analysis = useGetAnalysis(selectedAnalysisId!, {
    query: {
      queryKey: getGetAnalysisQueryKey(selectedAnalysisId!),
      enabled: selectedAnalysisId !== null,
      refetchInterval: (query) => query.state.data?.status === 'complete' || query.state.data?.status === 'failed' ? false : 3_000,
    }
  });

  const previewUrl = selectedAnalysisId
    ? getGetAnalysisPreviewUrl(selectedAnalysisId)
    : null;

  const { image, error: imageError, loading: imageLoading } = useImageLoader(previewUrl);

  const [editorState, setEditorState] = useState<EditorState>(defaultEditorState);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Whenever image or editor state changes, re-draw the canvas
    if (image && canvasRef.current) {
      drawToCanvas(canvasRef.current, image, editorState, true);
    }
  }, [image, editorState]);

  const handleEditorChange = (updates: Partial<EditorState>) => {
    setEditorState(prev => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    setEditorState(defaultEditorState);
  };

  const handleExport = () => {
    if (!image) return;
    try {
      const exportCanvas = document.createElement('canvas');
      drawToCanvas(exportCanvas, image, editorState, false);

      const dataUrl = exportCanvas.toDataURL(editorState.exportFormat, editorState.exportQuality / 100);

      const anchor = document.createElement('a');
      anchor.href = dataUrl;

      const originalName = analysis.data?.name || 'edited_image';
      const extMatch = originalName.match(/\.[^.]+$/);
      const ext = editorState.exportFormat === 'image/jpeg' ? '.jpg'
                : editorState.exportFormat === 'image/png' ? '.png'
                : '.webp';

      const baseName = extMatch ? originalName.slice(0, -extMatch[0].length) : originalName;
      anchor.download = `${baseName}_edited${ext}`;
      anchor.click();

      toast({ title: 'Export successful', description: anchor.download });
    } catch (err) {
      toast({
        title: t.operationFailed || 'Export failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const [copied, setCopied] = useState(false);
  const metadata = analysis.data?.metadata;

  const handleCopyMetadata = () => {
    if (!metadata?.allMetadata) return;
    navigator.clipboard.writeText(JSON.stringify(metadata.allMetadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMetadataJson = () => {
    if (!metadata?.allMetadata) return;
    const blob = new Blob([JSON.stringify(metadata.allMetadata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${analysis.data?.name.replace(/\.[^.]+$/, '')}-metadata.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ForensicsShell>
      <div className="flex h-[100dvh] flex-col">
        <TopBar
          eyebrow={t.photoEditorWorkspace}
          title={t.inspectImage}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Main Workspace (Preview) */}
          <div className="flex flex-1 flex-col border-r border-border bg-background p-6">
            <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.evidenceObject}</div>
                  <h3 className="mt-1 text-base font-semibold">{t.sourceMedia}</h3>
                </div>
                <FileImage className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-1 items-center justify-center bg-black/40 overflow-hidden relative p-4">
                {imageError ? (
                  <div className="text-center text-destructive">
                    <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-80" />
                    <p className="text-sm">Failed to load image</p>
                  </div>
                ) : imageLoading || analysis.isLoading ? (
                  <div className="text-center text-muted-foreground animate-pulse">
                    <p className="text-sm">Loading...</p>
                  </div>
                ) : selectedAnalysisId && image ? (
                  <canvas
                    ref={canvasRef}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <ImagePlus className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">{t.selectImageAnalysis}</p>
                  </div>
                )}
              </div>

              {selectedAnalysisId && analysis.data && (
                <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4 shrink-0">
                  <div className="bg-card p-3">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">{t.resolution}</div>
                    <div className="mt-1 font-mono text-xs">{metadata?.resolution || '—'}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">{t.container}</div>
                    <div className="mt-1 font-mono text-xs truncate" title={metadata?.container}>{metadata?.container || '—'}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">{t.codec}</div>
                    <div className="mt-1 font-mono text-xs truncate" title={metadata?.codec}>{metadata?.codec || '—'}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="font-mono text-[9px] uppercase text-muted-foreground">{t.size}</div>
                    <div className="mt-1 font-mono text-xs">{t.notPresent}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar (Properties/Settings) */}
          <div className="w-[400px] shrink-0 flex flex-col border-l border-border bg-sidebar overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-sm">{t.settings}</h3>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5 space-y-8">
                <div className="space-y-3">
                  <MediaDropUpload kind="image" onCreated={(created) => setSelectedAnalysisId(created.id)} />
                  <Label className="font-mono text-[10px] uppercase text-muted-foreground">{t.sourceMedia}</Label>
                  <Select value={selectedAnalysisId?.toString() || ''} onValueChange={v => setSelectedAnalysisId(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t.selectImageAnalysis} />
                    </SelectTrigger>
                    <SelectContent>
                      {imageAnalyses.map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>
                          <div className="flex items-center gap-2">
                            <FileImage className="h-3 w-3 opacity-70" />
                            <span className="truncate">{a.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <PhotoEditorControls
                  state={editorState}
                  onChange={handleEditorChange}
                  onReset={handleReset}
                  onExport={handleExport}
                  disabled={!image}
                />

                {selectedAnalysisId && metadata?.allMetadata && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{t.imageMetadata}</div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleCopyMetadata}>
                          {copied ? <CheckCircle2 className="h-3 w-3 text-teal-400 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copied ? t.copied : t.copyMetadata}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={downloadMetadataJson}>
                          <Download className="h-3 w-3 mr-1" /> JSON
                        </Button>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-sm border border-border bg-[#0d1117] p-4 text-xs shadow-inner">
                      <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10" />
                      <pre
                        className="font-mono text-[10px] leading-relaxed text-[#c9d1d9] selection:bg-primary/30 whitespace-pre-wrap break-all"
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
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </ForensicsShell>
  );
}
