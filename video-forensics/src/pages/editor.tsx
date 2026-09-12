import { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/lib/use-language';
import { ForensicsShell, TopBar } from '@/components/forensics-ui';
import { getGetAnalysisPreviewUrl, getListAnalysesQueryKey, useListAnalyses } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Play, Pause, Trash2, ArrowLeft, ArrowRight, Download, Video, Type, Volume2, Settings2, Image as ImageIcon, FileVideo } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MediaDropUpload } from '@/components/media-drop-upload';

interface Clip {
  id: string;
  ordinal: number;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  transition: 'none' | 'fade';
}

interface TextOverlay {
  id: string;
  content: string;
  start: number;
  end: number;
  x: number;
  y: number;
  size: number;
  color: string;
}

export default function EditorPage() {
  const { t, lang } = useLanguage();
  const { data: analyses } = useListAnalyses({ query: { queryKey: getListAnalysesQueryKey(), refetchInterval: 3_000 } });
  
  const videoAnalyses = useMemo(() => {
    return analyses?.filter(a => a.mediaType === 'video' && a.status !== 'failed') || [];
  }, [analyses]);

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [masterVolume, setMasterVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [sourceDuration, setSourceDuration] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [videoFilter, setVideoFilter] = useState<'none' | 'grayscale' | 'warm' | 'cool' | 'contrast'>('none');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isExporting, setIsExporting] = useState(false);

  // Timeline scale
  const pixelsPerSecond = 20;
  const duration = useMemo(() => clips.length
    ? Math.max(30, clips.reduce((acc, clip) => acc + (clip.sourceEnd - clip.sourceStart), 0) + 10)
    : Math.max(30, sourceDuration), [clips, sourceDuration]);
  const timelineStart = (index: number) => clips.slice(0, index)
    .reduce((total, clip) => total + clip.sourceEnd - clip.sourceStart, 0);

  const addClip = () => {
    setClips(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
         ordinal: prev.reduce((max, clip) => Math.max(max, clip.ordinal), 0) + 1,
         sourceStart: 0,
         sourceEnd: Math.min(5, sourceDuration || 5),
         timelineStart: prev.reduce((acc, c) => acc + c.sourceEnd - c.sourceStart, 0),
        transition: 'none'
      }
    ]);
  };

  const addText = () => {
    setTexts(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        content: 'New Text',
        start: 0,
        end: 5,
        x: 50,
        y: 50,
        size: 48,
        color: '#ffffff'
      }
    ]);
  };

  const removeClip = (id: string) => setClips(prev => prev.filter(c => c.id !== id));
  const removeText = (id: string) => setTexts(prev => prev.filter(t => t.id !== id));

  const updateClip = (id: string, updates: Partial<Clip>) => {
    setClips(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = { ...c, ...updates };
      const max = sourceDuration || Number.MAX_SAFE_INTEGER;
      next.sourceStart = Number.isFinite(next.sourceStart) ? Math.max(0, Math.min(next.sourceStart, Math.max(0, max - 0.05))) : c.sourceStart;
      next.sourceEnd = Number.isFinite(next.sourceEnd) ? Math.max(next.sourceStart + 0.05, Math.min(next.sourceEnd, max)) : c.sourceEnd;
      return next;
    }));
  };
  
  const updateText = (id: string, updates: Partial<TextOverlay>) => {
    setTexts(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, ...updates };
      const max = Math.max(0.05, duration);
      next.start = Number.isFinite(next.start) ? Math.max(0, Math.min(next.start, max - 0.05)) : t.start;
      next.end = Number.isFinite(next.end) ? Math.max(next.start + 0.05, Math.min(next.end, max)) : t.end;
      return next;
    }));
  };

  const moveClip = (index: number, dir: -1 | 1) => {
    setClips(prev => {
      const copy = [...prev];
      const target = index + dir;
      if (target < 0 || target >= copy.length) return copy;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const handleExport = async () => {
    if (!selectedAnalysisId) {
      toast({ title: t.selectVideoFirst, variant: 'destructive' });
      return;
    }
    
    setIsExporting(true);
    try {
      const res = await fetch('/api/editor/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: selectedAnalysisId,
           clips: clips.map(({ sourceStart, sourceEnd, transition }) => ({ start: sourceStart, end: sourceEnd, transition })),
          texts: texts.map(({ content, start, end, x, y, size, color }) => ({
            text: content,
            start,
            end,
            x,
            y,
            size,
            color,
          })),
          volume: masterVolume,
          muted,
          filter: videoFilter,
        })
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${selectedAnalysisId}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      toast({ title: t.exportSuccess });
    } catch (err) {
      toast({ title: t.exportFailed, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      void video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onLoadedMetadata = () => {
      const loadedDuration = Number.isFinite(video.duration) ? video.duration : 0;
      setSourceDuration(loadedDuration);
      setMediaError(null);
      setClips([{
        id: Math.random().toString(36).slice(2), ordinal: 1, sourceStart: 0,
        sourceEnd: loadedDuration, timelineStart: 0, transition: 'none',
      }]);
    };
    const onError = () => setMediaError('Unable to load the source video.');
    
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) onLoadedMetadata();
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
    };
  }, [selectedAnalysisId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = masterVolume;
      videoRef.current.muted = muted;
    }
  }, [masterVolume, muted]);

  const [activeTab, setActiveTab] = useState('settings');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  return (
    <ForensicsShell>
      <div className="flex h-[100dvh] flex-col">
        <TopBar 
          eyebrow={t.editorWorkspace} 
          title={t.newProject} 
          action={
            <Button onClick={handleExport} disabled={isExporting || !selectedAnalysisId} className="h-9 gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? t.exporting : t.export}
            </Button>
          }
        />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main Workspace (Preview + Timeline) */}
          <div className="flex flex-1 flex-col border-r border-border bg-background">
            
            {/* Preview Section */}
            <div className="flex aspect-video max-h-[50vh] w-full items-center justify-center border-b border-border bg-black">
              {selectedAnalysisId ? (
                <div className="relative h-full w-full">
                  <video 
                    ref={videoRef}
                     src={getGetAnalysisPreviewUrl(selectedAnalysisId)}
                     onVolumeChange={e => { setMasterVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
                     muted={muted}
                    className="h-full w-full object-contain"
                    style={{
                      filter: videoFilter === 'grayscale' ? 'grayscale(100%)' 
                            : videoFilter === 'warm' ? 'sepia(30%)' 
                            : videoFilter === 'cool' ? 'hue-rotate(180deg)' 
                            : videoFilter === 'contrast' ? 'contrast(150%)' 
                            : 'none'
                    }}
                  />
                  {/* Overlay text previews */}
                  {texts.map(text => (
                    (currentTime >= text.start && currentTime <= text.end) && (
                      <div 
                        key={text.id}
                        className="absolute whitespace-nowrap font-sans font-bold"
                        style={{
                          left: `${text.x}%`,
                          top: `${text.y}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize: `${text.size}px`,
                          color: text.color,
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                      >
                        {text.content}
                      </div>
                    )
                  ))}
                  
                  {/* Transport controls */}
                   {mediaError && <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded bg-destructive/80 px-3 py-1 text-xs text-white">{mediaError}</div>}
                   <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-black/50 px-6 py-2 backdrop-blur-md">
                    <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                      {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                    </button>
                    <div className="font-mono text-xs text-white/70">
                      {currentTime.toFixed(2)}s
                    </div>
                    <input aria-label="Seek" type="range" min={0} max={sourceDuration || 0} step={0.01} value={currentTime}
                      onChange={e => { const value = Number(e.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value); }}
                      className="w-32 accent-primary" />
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Video className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">{t.selectVideoFirst}</p>
                </div>
              )}
            </div>

            {/* Timeline Section */}
            <div className="flex flex-1 flex-col overflow-hidden bg-card/30">
              {/* Timeline Header Toolbar */}
              <div className="flex items-center gap-2 border-b border-border p-2">
                <Button variant="outline" size="sm" onClick={addClip} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> {t.addClip}
                </Button>
                <Button variant="outline" size="sm" onClick={addText} className="h-7 text-xs">
                  <Type className="mr-1 h-3 w-3" /> {t.addText}
                </Button>
              </div>

              {/* Tracks Scroll Area */}
              <ScrollArea className="flex-1">
                <div className="min-w-[800px] pb-12 pt-4">
                  {/* Ruler */}
                  <div className="relative mb-4 ml-[120px] h-6 border-b border-border/50">
                    {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
                      <div key={i} className="absolute top-0 flex h-full items-end" style={{ left: `${i * pixelsPerSecond}px` }}>
                        <div className="h-1 w-px bg-border"></div>
                        {i % 5 === 0 && <span className="ml-1 font-mono text-[9px] text-muted-foreground">{i}s</span>}
                      </div>
                    ))}
                    
                    {/* Playhead marker on ruler */}
                    <div 
                      className="absolute top-0 bottom-0 z-20 w-px bg-primary" 
                       style={{ left: `${currentTime * pixelsPerSecond}px` }}
                       onClick={(e) => { const rect = e.currentTarget.parentElement?.getBoundingClientRect(); if (rect && videoRef.current) { const value = Math.max(0, Math.min(sourceDuration || duration, (e.clientX - rect.left) / pixelsPerSecond)); videoRef.current.currentTime = value; setCurrentTime(value); } }}
                    >
                      <div className="absolute top-0 -translate-x-1/2 -translate-y-full border-[5px] border-transparent border-t-primary" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Video Track */}
                    <div className="flex items-center">
                      <div className="w-[120px] shrink-0 px-4 font-mono text-[10px] uppercase text-muted-foreground">
                        {t.videoTrack}
                      </div>
                      <div className="relative h-16 flex-1 rounded bg-black/20 instrument-grid shadow-inner">
                        {clips.map((clip, idx) => (
                          <div
                            key={clip.id}
                            onClick={() => { setSelectedItemId(clip.id); setActiveTab('clip'); }}
                            className={`absolute top-1 bottom-1 rounded border overflow-hidden ${selectedItemId === clip.id ? 'border-primary ring-1 ring-primary' : 'border-primary/30'} bg-primary/10 transition-colors hover:bg-primary/20 cursor-pointer`}
                            style={{
                               left: `${timelineStart(idx) * pixelsPerSecond}px`,
                               width: `${(clip.sourceEnd - clip.sourceStart) * pixelsPerSecond}px`
                            }}
                          >
                            <div className="flex h-full items-center px-2">
                              <span className="truncate font-mono text-[10px] text-primary">Clip {clip.ordinal}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Text Track */}
                    <div className="flex items-center">
                      <div className="w-[120px] shrink-0 px-4 font-mono text-[10px] uppercase text-muted-foreground">
                        {t.textTrack}
                      </div>
                      <div className="relative h-12 flex-1 rounded bg-black/20 instrument-grid shadow-inner">
                        {texts.map((text, idx) => (
                          <div
                            key={text.id}
                            onClick={() => { setSelectedItemId(text.id); setActiveTab('text'); }}
                            className={`absolute top-1 bottom-1 rounded border ${selectedItemId === text.id ? 'border-accent ring-1 ring-accent' : 'border-accent/30'} bg-accent/10 transition-colors hover:bg-accent/20 cursor-pointer overflow-hidden`}
                            style={{
                              left: `${text.start * pixelsPerSecond}px`,
                              width: `${(text.end - text.start) * pixelsPerSecond}px`
                            }}
                          >
                            <div className="flex h-full items-center px-2">
                              <span className="truncate font-sans text-xs text-accent">"{text.content}"</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Audio Track */}
                    <div className="flex items-center">
                      <div className="w-[120px] shrink-0 px-4 font-mono text-[10px] uppercase text-muted-foreground">
                        {t.audioTrack}
                      </div>
                      <div className="relative h-12 flex-1 rounded bg-black/20 instrument-grid shadow-inner">
                        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary/20" />
                        {clips.map((clip, idx) => (
                          <div
                            key={`audio-${clip.id}`}
                            className="absolute top-2 bottom-2 rounded-full bg-primary/20 opacity-50"
                            style={{
                               left: `${timelineStart(idx) * pixelsPerSecond}px`,
                               width: `${(clip.sourceEnd - clip.sourceStart) * pixelsPerSecond}px`
                            }}
                          >
                             {/* Faux waveform */}
                             <div className="flex h-full items-center justify-around gap-[1px] px-1 opacity-30">
                               {[...Array(Math.max(1, Math.floor((clip.sourceEnd - clip.sourceStart) * 2)))].map((_, i) => (
                                  <div key={i} className="w-[2px] bg-primary" style={{ height: `${20 + Math.random() * 80}%` }} />
                               ))}
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Sidebar (Properties/Settings) */}
          <div className="w-[320px] shrink-0 flex flex-col border-l border-border bg-sidebar overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              <div className="px-4 py-3 border-b border-border">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="settings" className="text-xs">{t.settings}</TabsTrigger>
                  <TabsTrigger value="clip" className="text-xs" disabled={!clips.find(c => c.id === selectedItemId)}>Clip</TabsTrigger>
                  <TabsTrigger value="text" className="text-xs" disabled={!texts.find(t => t.id === selectedItemId)}>Text</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  <TabsContent value="settings" className="m-0 space-y-6">
                    <div className="space-y-3">
                    <MediaDropUpload
                      kind="video"
                      onCreated={(created) => {
                        setSelectedAnalysisId(created.id);
                         setClips([]);
                      }}
                    />
                      <Label className="font-mono text-[10px] uppercase text-muted-foreground">{t.sourceMedia}</Label>
                      <Select value={selectedAnalysisId?.toString() || ''} onValueChange={v => { setSelectedAnalysisId(Number(v)); setClips([]); setCurrentTime(0); setSourceDuration(0); }}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t.selectSourceMedia} />
                        </SelectTrigger>
                        <SelectContent>
                          {videoAnalyses.map(a => (
                            <SelectItem key={a.id} value={a.id.toString()}>
                              <div className="flex items-center gap-2">
                                <FileVideo className="h-3 w-3 opacity-70" />
                                <span className="truncate">{a.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
                        {t.masterVolume}
                        <span className="text-primary">{Math.round(masterVolume * 100)}%</span>
                      </Label>
                      <Slider
                        value={[masterVolume * 100]}
                        onValueChange={v => setMasterVolume(v[0] / 100)}
                        max={100}
                        step={1}
                      />
                      <Button type="button" variant={muted ? 'destructive' : 'outline'} size="sm" onClick={() => setMuted(value => !value)} className="w-full">
                        <Volume2 className="mr-2 h-3.5 w-3.5" />
                        {muted ? (lang === 'cs' ? 'Zvuk je ztlumený' : 'Audio muted') : (lang === 'cs' ? 'Ztlumit zvuk' : 'Mute audio')}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Label className="font-mono text-[10px] uppercase text-muted-foreground">{t.videoFilter}</Label>
                      <Select value={videoFilter} onValueChange={(v: any) => setVideoFilter(v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.filterNone}</SelectItem>
                          <SelectItem value="grayscale">{t.filterGrayscale}</SelectItem>
                          <SelectItem value="warm">{t.filterWarm}</SelectItem>
                          <SelectItem value="cool">{t.filterCool}</SelectItem>
                          <SelectItem value="contrast">{t.filterHighContrast}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="clip" className="m-0 space-y-6">
                    {clips.map((clip, idx) => clip.id === selectedItemId && (
                      <div key={clip.id} className="space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm">Clip {clip.ordinal}</h3>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveClip(idx, -1)} disabled={idx === 0}>
                              <ArrowLeft className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveClip(idx, 1)} disabled={idx === clips.length - 1}>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { removeClip(clip.id); setSelectedItemId(null); setActiveTab('settings'); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.startTime} (s)</Label>
                           <Input type="number" min={0} max={sourceDuration || undefined} step="0.1" value={clip.sourceStart} onChange={e => updateClip(clip.id, { sourceStart: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.endTime} (s)</Label>
                           <Input type="number" min={0} max={sourceDuration || undefined} step="0.1" value={clip.sourceEnd} onChange={e => updateClip(clip.id, { sourceEnd: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                        </div>

                        <div className="space-y-2">
                           <Label className="font-mono text-[10px] text-muted-foreground">{t.transition} (per-clip fade)</Label>
                          <Select value={clip.transition} onValueChange={(v: any) => updateClip(clip.id, { transition: v })}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t.transitionNone}</SelectItem>
                               <SelectItem value="fade">Fade in/out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="text" className="m-0 space-y-6">
                    {texts.map(text => text.id === selectedItemId && (
                      <div key={text.id} className="space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm">Text Overlay</h3>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { removeText(text.id); setSelectedItemId(null); setActiveTab('settings'); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label className="font-mono text-[10px] text-muted-foreground">{t.textContent}</Label>
                          <Input value={text.content} onChange={e => updateText(text.id, { content: e.target.value })} className="h-8 text-xs" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.startTime} (s)</Label>
                            <Input type="number" step="0.1" value={text.start} onChange={e => updateText(text.id, { start: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.endTime} (s)</Label>
                            <Input type="number" step="0.1" value={text.end} onChange={e => updateText(text.id, { end: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">X {t.position} (%)</Label>
                            <Input type="number" value={text.x} onChange={e => updateText(text.id, { x: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">Y {t.position} (%)</Label>
                            <Input type="number" value={text.y} onChange={e => updateText(text.id, { y: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.size}</Label>
                            <Input type="number" value={text.size} onChange={e => updateText(text.id, { size: Number(e.target.value) })} className="h-8 font-mono text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-mono text-[10px] text-muted-foreground">{t.color}</Label>
                            <div className="flex items-center gap-2">
                              <Input type="color" value={text.color} onChange={e => updateText(text.id, { color: e.target.value })} className="h-8 w-8 p-1" />
                              <Input value={text.color} onChange={e => updateText(text.id, { color: e.target.value })} className="h-8 flex-1 font-mono text-xs" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </div>
    </ForensicsShell>
  );
}
