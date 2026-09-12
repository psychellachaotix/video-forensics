import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const DETAILS = ['Initiation', 'Evidence Intake', 'Technical Inspection', 'Manual Override', 'AI Roadmap', 'Outro'];
const FILE = 'src/components/video/video_scenes.tsx';
const formatTime = (ms: number) => `${Math.floor(ms / 60000)}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);

  useEffect(() => {
    setElapsed(0); elapsedBase.current = 0;
  }, [controls.tick]);
  useEffect(() => {
    if (controls.paused) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(elapsedBase.current + performance.now() - start), 60);
    return () => { window.clearInterval(id); elapsedBase.current += performance.now() - start; };
  }, [controls.paused, controls.tick]);
  useEffect(() => {
    if (!controls.paused) return;
    const animations = document.getAnimations().filter(a => a.playState === 'running');
    animations.forEach(a => a.pause());
    return () => animations.forEach(a => a.play());
  }, [controls.paused]);

  const jumpTo = useCallback((index: number) => {
    controls.jumpTo(index);
    window.parent.postMessage({ type: 'REPLIT_VIDEO_SCENE_SELECTED', payload: {
      sceneIndex: index, sceneCount: controls.sceneKeys.length, sceneTitle: DETAILS[index],
      filePath: FILE, lineNumber: 1,
    }}, '*');
  }, [controls]);

  if (!isIframed) return <VideoTemplate />;
  const progress = Math.min(1, elapsed / controls.activeDuration);
  const totalElapsed = Math.min(controls.totalDuration, controls.activeStartTime + Math.min(elapsed, controls.activeDuration));
  const visible = !collapsed || hovering;
  const button = 'w-12 h-12 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0';
  return (
    <div className="relative w-full h-screen">
      <VideoTemplate key={controls.mountKey} durations={controls.durations} paused={controls.paused}
        muted={muted} onSceneChange={controls.onSceneChange} />
      <div className="absolute bottom-0 inset-x-0 z-50 flex flex-col justify-end" style={{ height: '25%' }}
        onPointerEnter={e => e.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={e => e.pointerType === 'mouse' && setHovering(false)}>
        <div className="flex-1" />
        <div className={`flex items-center gap-3 bg-black/60 backdrop-blur-md px-5 py-3 transition-all ${visible ? '' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <button className={button} onClick={controls.togglePause} aria-label={controls.paused ? 'Play' : 'Pause'}>
            {controls.paused ? <Play /> : <Pause />}
          </button>
          <button className={`${button} ${controls.locked ? 'bg-white/15 text-white' : ''}`} onClick={controls.toggleLock} aria-label="Loop current scene"><Repeat /></button>
          <button className={button} onClick={() => setMuted(v => !v)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <div className="w-px self-stretch bg-white/15" />
          <div className="flex-1 flex gap-1.5">
            {controls.sceneKeys.map((key, i) => <button key={key} onClick={() => jumpTo(i)}
              aria-label={`Jump to scene ${i + 1}`} className="relative flex-1 h-3 rounded-full overflow-hidden bg-white/20">
              <span className="absolute inset-y-0 left-0 bg-[#bedf35]" style={{ width: `${i === controls.activeIndex ? progress * 100 : 0}%` }} />
            </button>)}
          </div>
          <span className="font-mono text-white/70">{controls.activeIndex + 1}/{controls.sceneKeys.length}</span>
          <span className="font-mono text-white/80 min-w-[9ch] text-right">{formatTime(totalElapsed)} / {formatTime(controls.totalDuration)}</span>
          <button className={button} onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Show controls' : 'Hide controls'}>
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>
    </div>
  );
}