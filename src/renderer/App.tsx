import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Analysis, AppSettings, CaseRecord, PhotoEdit, VideoEdit } from "../shared/types";

type View = "cases" | "analysis" | "agents" | "metadata" | "video-editor" | "photo-editor" | "settings";
const emptyPhoto: PhotoEdit = { rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100, grayscale: false, sepia: false, format: "png", quality: 92 };
const emptyVideo: VideoEdit = { clips: [], filter: "none", volume: 1, muted: false, text: "" };

function ErrorText({ error }: { error: string }) { return error ? <div className="error">{error}</div> : null; }
function Label({ children }: { children: ReactNode }) { return <label className="label">{children}</label>; }

const Icons = {
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Cases: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
  Analysis: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
  Agents: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>,
  Metadata: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  VideoEditor: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>,
  PhotoEditor: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Settings: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  Video: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
  Image: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
  FlipH: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
};

export default function App() {
  if (!window.videoForensics) {
    return <div className="app-fatal">
      <div className="panel">
        <span className="eyebrow">CHYBA DESKTOPOVÉHO SPOJENÍ</span>
        <h1>Aplikace se nespustila správně</h1>
        <p>Windows proces neposkytl rozhraní pro práci se soubory. Zavřete aplikaci a spusťte ji znovu. Pokud chyba zůstane, použijte novější sestavení.</p>
        <code>window.videoForensics není dostupné</code>
      </div>
    </div>;
  }

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [view, setView] = useState<View>("cases");
  const [analysis, setAnalysis] = useState<Analysis>();
  const [progress, setProgress] = useState({ percent: 0, phase: "", detail: "", etaSeconds: null as number | null });
  const [settings, setSettings] = useState<AppSettings>();
  const [error, setError] = useState("");
  
  const selected = cases.find((item) => item.id === selectedId);
  const refresh = async () => {
    try {
      setCases(await window.videoForensics.cases.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  
  useEffect(() => { 
    void refresh(); 
    void window.videoForensics.settings.get().then(setSettings).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const off = window.videoForensics.analysis.onProgress(setProgress); 
    return off; 
  }, []);
  
  const choose = (record: CaseRecord) => { 
    const assetId = record.analyses.at(-1)?.assetId ?? record.assets[0]?.id; 
    setSelectedId(record.id); 
    setSelectedAssetId(assetId); 
    setView("analysis"); 
    setAnalysis(assetId ? record.analyses.filter((item) => item.assetId === assetId).at(-1) : undefined); 
  };
  
  const createCase = async () => { 
    const name = window.prompt("Název případu"); 
    if (!name) return; 
    try {
      setError("");
      const record = await window.videoForensics.cases.create(name);
      await refresh();
      choose(record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  
  const importMedia = async () => { 
    if (!selected) return; 
    try { 
      setError(""); 
      const result = await window.videoForensics.media.import(selected.id); 
      if (result) { 
        await refresh(); 
        setView("analysis"); 
      } 
    } catch (e) { 
      setError(e instanceof Error ? e.message : String(e)); 
    } 
  };
  
  const startAnalysis = async (assetId: string) => { 
    if (!selected) return; 
    try { 
      setError(""); 
      setSelectedAssetId(assetId); 
      const result = await window.videoForensics.analysis.start(selected.id, assetId); 
      setAnalysis(result); 
      await refresh(); 
      setView("analysis"); 
    } catch (e) { 
      setError(e instanceof Error ? e.message : String(e)); 
    } 
  };
  
  const deleteCase = async () => { 
    if (!selected || !window.confirm(`Smazat případ ${selected.name}?`)) return; 
    await window.videoForensics.cases.delete(selected.id); 
    setSelectedId(undefined); 
    setAnalysis(undefined); 
    await refresh(); 
    setView("cases"); 
  };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">VF</span><div><b>VIDEO FORENSICS</b><small>LOCAL DESKTOP / WIN x64</small></div></div>
      <button className="primary" onClick={createCase}><Icons.Plus /> Nový případ</button>
      <nav>
        <button className={view === "cases" ? "active" : ""} onClick={() => setView("cases")}><Icons.Cases /> Případy</button>
        <button className={view === "analysis" ? "active" : ""} onClick={() => setView("analysis")}><Icons.Analysis /> Analýza</button>
        <button className={view === "agents" ? "active" : ""} onClick={() => setView("agents")}><Icons.Agents /> Agenti / log</button>
        <button className={view === "metadata" ? "active" : ""} onClick={() => setView("metadata")}><Icons.Metadata /> Metadata</button>
        <button className={view === "video-editor" ? "active" : ""} onClick={() => setView("video-editor")}><Icons.VideoEditor /> Video editor</button>
        <button className={view === "photo-editor" ? "active" : ""} onClick={() => setView("photo-editor")}><Icons.PhotoEditor /> Photo editor</button>
      </nav>
      <div className="case-list">
        <span className="eyebrow">LOKÁLNÍ PŘÍPADY</span>
        {cases.map((item) => <button key={item.id} className={selectedId === item.id ? "case selected" : "case"} onClick={() => choose(item)}><strong>{item.name}</strong><small>{item.assets.length} důkazů · {item.analyses.length} analýz</small></button>)}
        {!cases.length && <p className="muted" style={{ padding: '0 12px' }}>Zatím žádné případy.</p>}
      </div>
      <button className={view === "settings" ? "settings active" : "settings"} onClick={() => setView("settings")}><Icons.Settings /> Nastavení</button>
    </aside>
    <main className="main">
      <header><div><span className="eyebrow">FORENSIC WORKSPACE</span><h1>{viewTitle(view)}</h1></div><div className="header-status"><i /> OFFLINE-FIRST · DATA V USERDATA</div></header>
      <ErrorText error={error} />
      {!selected && view !== "settings" ? (view === "cases" ? <EmptyCases onCreate={createCase} /> : <FeatureStart view={view} onCreate={createCase} />) : <>
        {view === "cases" && selected && <CaseView record={selected} onImport={importMedia} onAnalyze={startAnalysis} onDelete={deleteCase} />}
        {view === "analysis" && selected && <AnalysisView record={selected} assetId={selectedAssetId} analysis={analysis} progress={progress} onImport={importMedia} onAnalyze={startAnalysis} onReport={async () => { const current = selected.analyses.filter((item) => item.assetId === selectedAssetId).at(-1) ?? analysis; if (current) return window.videoForensics.report.export(selected.id, current.id); return null; }} />}
        {view === "agents" && selected && <AgentsView record={selected} assetId={selectedAssetId} />}
        {view === "metadata" && selected && <MetadataView record={selected} assetId={selectedAssetId} />}
        {view === "video-editor" && selected && <VideoEditor record={selected} onImport={importMedia} />}
        {view === "photo-editor" && selected && <PhotoEditor record={selected} onImport={importMedia} />}
      </>}
      {view === "settings" && <SettingsView settings={settings} onChange={setSettings} />}
    </main>
  </div>;
}

function viewTitle(view: View) { return ({ cases: "Případy", analysis: "Analýza důkazů", agents: "Agenti / auditní stopa", metadata: "Metadata", "video-editor": "Nedestruktivní video editor", "photo-editor": "Nedestruktivní photo editor", settings: "Nastavení a soukromí" })[view]; }

function EmptyCases({ onCreate }: { onCreate: () => void }) { 
  return <section className="empty">
    <div className="crosshair"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>
    <h2>Začněte novým případem</h2>
    <p>Všechny soubory zůstávají v lokálním Electron userData. Pro AI interpretaci je nutný samostatný Anthropic API klíč.</p>
    <button className="primary" onClick={onCreate}><Icons.Plus /> Vytvořit případ</button>
  </section>; 
}

function FeatureStart({ view, onCreate }: { view: Exclude<View, "cases" | "settings">; onCreate: () => void }) {
  const copy = {
    analysis: ["Analýza potřebuje případ", "Vytvořte případ, přidejte video nebo obrázek a spusťte lokální forenzní analýzu."],
    agents: ["Auditní stopa potřebuje případ", "Po analýze zde uvidíte jednotlivé kroky, stav agentů a případné chyby."],
    metadata: ["Metadata potřebují případ", "Vytvořte případ a importujte důkaz, aby bylo možné načíst technická metadata."],
    "video-editor": ["Nejdřív vytvořte případ", "Potom přidejte video. Editor se otevře bez nutnosti spouštět forenzní analýzu."],
    "photo-editor": ["Nejdřív vytvořte případ", "Potom přidejte obrázek. Editor se otevře bez nutnosti spouštět forenzní analýzu."],
  }[view];
  return <section className="empty">
    <div className="crosshair"><Icons.Plus /></div>
    <h2>{copy[0]}</h2>
    <p>{copy[1]}</p>
    <button className="primary" onClick={onCreate}><Icons.Plus /> Vytvořit případ</button>
  </section>;
}

function CaseView({ record, onImport, onAnalyze, onDelete }: { record: CaseRecord; onImport: () => void; onAnalyze: (id: string) => void; onDelete: () => void }) {
  return <section>
    <div className="toolbar">
      <div><span className="eyebrow">CASE / {record.id.slice(0, 8)}</span><h2>{record.name}</h2></div>
      <div><button className="outline danger" onClick={onDelete}><Icons.Trash /> Smazat případ</button><button className="primary" onClick={onImport}><Icons.Plus /> Přidat důkaz</button></div>
    </div>
    <div className="grid cards">
      {record.assets.map((asset) => <AssetCard key={asset.id} record={record} asset={asset} onAnalyze={onAnalyze} />)}
    </div>
    {!record.assets.length && <div className="panel muted">Přidejte lokální MP4, MOV, AVI, MKV nebo obrázek JPG, PNG, WebP.</div>}
  </section>;
}

function AssetCard({ record, asset, onAnalyze }: { record: CaseRecord; asset: CaseRecord["assets"][number]; onAnalyze: (id: string) => void }) {
  const [busy, setBusy] = useState(false); 
  const analysis = record.analyses.filter((item) => record.assets.some((candidate) => candidate.id === asset.id) && item).at(-1);
  return <article className="card">
    <div className="asset-preview">
      {asset.kind === "video" ? <video controls src={window.videoForensics.media.url(record.id, asset.id)} /> : <img src={window.videoForensics.media.url(record.id, asset.id)} />}
    </div>
    <div className="card-body">
      <div className="eyebrow">{asset.kind} · {formatBytes(asset.size)}</div>
      <h3 title={asset.originalName}>{asset.originalName}</h3>
      <code>SHA-256 {asset.sha256.slice(0, 18)}…</code>
      <button className="outline full" disabled={busy} onClick={async () => { setBusy(true); onAnalyze(asset.id); setBusy(false); }}>
        <Icons.Analysis /> {busy ? "Spouštím…" : "Spustit lokální analýzu"}
      </button>
      {analysis && <small className="muted" style={{ display: 'block', marginTop: '12px', textAlign: 'center' }}>Poslední analýza: {analysis.progress.percent}%</small>}
    </div>
  </article>;
}

function AnalysisView({ record, assetId, analysis, progress, onImport, onAnalyze, onReport }: { record: CaseRecord; assetId?: string; analysis?: Analysis; progress: { percent: number; phase: string; detail: string; etaSeconds: number | null }; onImport: () => void; onAnalyze: (id: string) => void; onReport: () => Promise<unknown> }) {
  const asset = record.assets.find((item) => item.id === assetId); 
  const current = analysis?.assetId === assetId ? analysis : record.analyses.filter((item) => item.assetId === assetId).at(-1); 
  
  return <section>
    <div className="toolbar">
      <div><span className="eyebrow">LOCAL PIPELINE / TRUTHFUL PROGRESS</span><h2>{record.name} · {asset?.originalName ?? "vyberte důkaz"}</h2></div>
      <div><button className="outline" onClick={onImport}><Icons.Plus /> Důkaz</button>{current && <button className="outline" onClick={() => void onReport()}><Icons.Download /> Export HTML report</button>}</div>
    </div>
    {current && current.progress.percent < 100 && <div className="progress panel">
      <div className="progress-head"><b>{progress.phase || current.progress.phase}</b><span>{progress.percent || current.progress.percent}%{progress.etaSeconds != null ? ` · ETA ${progress.etaSeconds}s` : ""}</span></div>
      <div className="bar"><i style={{ width: `${progress.percent || current.progress.percent}%` }} /></div>
      <p>{progress.detail || current.progress.detail}</p>
    </div>}
    <div className="grid stats">
      <Stat label="Verdikt Interpret" value={current?.interpret?.verdict ?? "NEURCENO"} />
      <Stat label="Verifier" value={current?.verifier?.finalStatus ?? (current?.errors.length ? "CHYBA_API" : "—")} />
      <Stat label="Nálezy" value={String(current?.findings.length ?? 0)} />
      <Stat label="AI odhad" value={current?.aiUsage?.estimatedCostUsd === null ? "nedostupný" : `$${(current?.aiUsage?.estimatedCostUsd ?? 0).toFixed(4)}`} />
    </div>
    <div className="panel">
      <h3>Důkazní soubory</h3>
      {record.assets.map((item) => <div className={`row ${item.id === assetId ? "selected-row" : ""}`} key={item.id}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{item.kind === "video" ? <Icons.Video /> : <Icons.Image />} {item.originalName}</span>
        <button className="outline" onClick={() => onAnalyze(item.id)}><Icons.Refresh /> Analyzovat znovu</button>
      </div>)}
    </div>
    {current && <div className="panel">
      <h3>Technická zjištění</h3>
      {current.findings.map((item) => <div className="finding" key={item.id}>
        <b>{item.title}</b><span className={`severity ${item.severity}`}>{item.severity}</span>
        <p>{item.detail}</p>
      </div>)}
    </div>}
    {!current && asset && <div className="panel muted">Vyberte důkaz a spusťte analýzu.</div>}
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="stat"><span>{label}</span><b>{value}</b></div>; }

function AgentsView({ record, assetId }: { record: CaseRecord; assetId?: string }) { 
  const analysis = record.analyses.filter((item) => item.assetId === assetId).at(-1); 
  return <section className="two-col">
    <div className="panel"><span className="eyebrow">PIPELINE LOG</span>{analysis?.steps.map((step) => <div className="row" key={step.stepName}><span>{step.stepName}</span><strong className={`status ${step.stepStatus.toLowerCase()}`}>{step.stepStatus}</strong></div>)}</div>
    <div className="panel">
      <h3>Interpret</h3><p className="muted" style={{ marginBottom: '24px' }}>{analysis?.interpret?.reasoning || "AI odpověď není dostupná."}</p>
      <h3>Verifier</h3><p className="muted">{analysis?.verifier?.comment || "Verifier dosud neběžel."}</p>
      {analysis?.errors.map((item) => <div className="error" key={item} style={{ margin: '16px 0 0' }}>{item}</div>)}
    </div>
  </section>; 
}

function MetadataView({ record, assetId }: { record: CaseRecord; assetId?: string }) { 
  const analysis = record.analyses.filter((item) => item.assetId === assetId).at(-1); 
  return <section className="panel">
    <div className="toolbar">
      <div><h2>Raw metadata / ffprobe</h2><span className="eyebrow">{analysis?.metadata?.container as string || "NEZPRACOVÁNO"}</span></div>
    </div>
    <pre>{JSON.stringify(analysis?.metadata ?? {}, null, 2)}</pre>
  </section>; 
}

function VideoEditor({ record, onImport }: { record: CaseRecord; onImport: () => void }) {
  const video = record.assets.find((item) => item.kind === "video"); 
  const [edit, setEdit] = useState<VideoEdit>({ ...emptyVideo, clips: video ? [{ id: crypto.randomUUID(), sourceAssetId: video.id, start: 0, end: 10 }] : [] }); 
  const [message, setMessage] = useState("");
  
  if (!video) return <MissingMedia kind="video" onImport={onImport} />;
  
  return <section>
    <div className="panel editor-preview"><video controls src={window.videoForensics.media.url(record.id, video.id)} /></div>
    <div className="panel controls">
      <h3>Pořadí klipů</h3>
      {edit.clips.map((clip, index) => <div className="clip" key={clip.id}>
        <b>#{index + 1}</b>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="number" min="0" step=".1" value={clip.start} onChange={(event) => setEdit({ ...edit, clips: edit.clips.map((item) => item.id === clip.id ? { ...item, start: Number(event.target.value) } : item) })} />
          <span className="muted">—</span>
          <input type="number" min="0" step=".1" value={clip.end} onChange={(event) => setEdit({ ...edit, clips: edit.clips.map((item) => item.id === clip.id ? { ...item, end: Number(event.target.value) } : item) })} />
        </div>
        <button className="outline" onClick={() => setEdit({ ...edit, clips: edit.clips.filter((item) => item.id !== clip.id) })}><Icons.Trash /> Odebrat</button>
      </div>)}
      <button className="outline" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ ...edit, clips: [...edit.clips, { id: crypto.randomUUID(), sourceAssetId: video.id, start: 0, end: 10 }] })}><Icons.Plus /> Klip</button>
      <div className="controls-grid">
        <Label>Filtr<select value={edit.filter} onChange={(event) => setEdit({ ...edit, filter: event.target.value as VideoEdit["filter"] })}><option value="none">Bez filtru</option><option value="grayscale">Grayscale</option><option value="sepia">Sepia</option><option value="brightness">Jas</option><option value="contrast">Kontrast</option></select></Label>
        <Label>Hlasitost<input type="number" min="0" max="2" step=".1" value={edit.volume} onChange={(event) => setEdit({ ...edit, volume: Number(event.target.value) })} /></Label>
        <Label>Text overlay<input value={edit.text} onChange={(event) => setEdit({ ...edit, text: event.target.value })} /></Label>
      </div>
      <label className="check"><input type="checkbox" checked={edit.muted} onChange={(event) => setEdit({ ...edit, muted: event.target.checked })} /> Ztlumit zvuk</label>
      <div className="button-row">
        <button className="primary" onClick={async () => { try { const file = await window.videoForensics.editor.videoExport(record.id, edit); setMessage(file ? `Exportováno: ${file}` : "Export zrušen."); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } }}><Icons.Download /> Exportovat přes ffmpeg</button>
      </div>
      {message && <p className="muted">{message}</p>}
    </div>
  </section>;
}

function PhotoEditor({ record, onImport }: { record: CaseRecord; onImport: () => void }) {
  const image = record.assets.find((item) => item.kind === "image"); 
  const [edit, setEdit] = useState<PhotoEdit>(emptyPhoto); 
  const [message, setMessage] = useState(""); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const source = new Image();
    source.onload = () => {
      const quarterTurn = edit.rotation === 90 || edit.rotation === 270;
      const canvas = canvasRef.current!;
      const transformed = document.createElement("canvas");
      transformed.width = quarterTurn ? source.height : source.width;
      transformed.height = quarterTurn ? source.width : source.height;
      const context = transformed.getContext("2d");
      if (!context) return;
      context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%)${edit.grayscale ? " grayscale(1)" : ""}${edit.sepia ? " sepia(1)" : ""}`;
      context.translate(transformed.width / 2, transformed.height / 2);
      context.rotate(edit.rotation * Math.PI / 180);
      context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
      context.drawImage(source, -source.width / 2, -source.height / 2);
      const crop = edit.crop;
      if (crop && crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= transformed.width && crop.y + crop.height <= transformed.height) {
        canvas.width = crop.width; canvas.height = crop.height;
        canvas.getContext("2d")?.drawImage(transformed, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      } else {
        canvas.width = transformed.width; canvas.height = transformed.height;
        canvas.getContext("2d")?.drawImage(transformed, 0, 0);
      }
    };
    source.src = window.videoForensics.media.url(record.id, image.id);
  }, [record.id, image?.id, edit]);
  
  if (!image) return <MissingMedia kind="image" onImport={onImport} />;
  const patch = (value: Partial<PhotoEdit>) => setEdit((current) => ({ ...current, ...value }));
  
  return <section className="two-col">
    <div className="panel photo-preview"><canvas ref={canvasRef} /></div>
    <div className="panel controls">
      <h3>Úpravy bez změny originálu</h3>
      <Label>Jas <input type="range" min="0" max="200" value={edit.brightness} onChange={(event) => patch({ brightness: Number(event.target.value) })} /></Label>
      <Label>Kontrast <input type="range" min="0" max="200" value={edit.contrast} onChange={(event) => patch({ contrast: Number(event.target.value) })} /></Label>
      <Label>Saturace <input type="range" min="0" max="200" value={edit.saturation} onChange={(event) => patch({ saturation: Number(event.target.value) })} /></Label>
      <div className="button-row">
        <button className="outline" onClick={() => patch({ rotation: ((edit.rotation + 90) % 360) as PhotoEdit["rotation"] })}><Icons.Refresh /> Otočit</button>
        <button className="outline" onClick={() => patch({ flipX: !edit.flipX })}><Icons.FlipH /> Překlopit</button>
        <button className="outline" onClick={() => patch({ grayscale: !edit.grayscale })}>Grayscale</button>
        <button className="outline" onClick={() => patch({ sepia: !edit.sepia })}>Sepia</button>
      </div>
      <div className="controls-grid">
        <Label>Crop X<input type="number" value={edit.crop?.x ?? 0} onChange={(event) => patch({ crop: { x: Number(event.target.value), y: edit.crop?.y ?? 0, width: edit.crop?.width ?? 0, height: edit.crop?.height ?? 0 } })} /></Label>
        <Label>Crop Y<input type="number" value={edit.crop?.y ?? 0} onChange={(event) => patch({ crop: { x: edit.crop?.x ?? 0, y: Number(event.target.value), width: edit.crop?.width ?? 0, height: edit.crop?.height ?? 0 } })} /></Label>
        <Label>Crop šířka<input type="number" value={edit.crop?.width ?? 0} onChange={(event) => patch({ crop: { x: edit.crop?.x ?? 0, y: edit.crop?.y ?? 0, width: Number(event.target.value), height: edit.crop?.height ?? 0 } })} /></Label>
        <Label>Crop výška<input type="number" value={edit.crop?.height ?? 0} onChange={(event) => patch({ crop: { x: edit.crop?.x ?? 0, y: edit.crop?.y ?? 0, width: edit.crop?.width ?? 0, height: Number(event.target.value) } })} /></Label>
      </div>
      <Label>Formát<select value={edit.format} onChange={(event) => patch({ format: event.target.value as PhotoEdit["format"] })}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></Label>
      <div className="button-row">
        <button className="primary" onClick={async () => { try { const file = await window.videoForensics.editor.photoExport(record.id, image.id, edit); setMessage(file ? `Exportováno: ${file}` : "Export zrušen."); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } }}><Icons.Download /> Uložit kopii</button>
      </div>
      {message && <p className="muted">{message}</p>}
    </div>
  </section>;
}

function MissingMedia({ kind, onImport }: { kind: "video" | "image"; onImport: () => void }) {
  const isVideo = kind === "video";
  return <section className="empty">
    <div className="crosshair">{isVideo ? <Icons.Video /> : <Icons.Image />}</div>
    <h2>{isVideo ? "Přidejte video do případu" : "Přidejte obrázek do případu"}</h2>
    <p>{isVideo ? "Video editor podporuje MP4, MOV, AVI a MKV." : "Photo editor podporuje JPG, PNG a WebP."}</p>
    <button className="primary" onClick={onImport}><Icons.Plus /> {isVideo ? "Vybrat video" : "Vybrat obrázek"}</button>
  </section>;
}

function SettingsView({ settings, onChange }: { settings?: AppSettings; onChange: (value: AppSettings) => void }) {
  const [key, setKey] = useState(""); 
  const [ffmpegPath, setFfmpegPath] = useState(settings?.binaries.ffmpegPath ?? ""); 
  const [ffprobePath, setFfprobePath] = useState(settings?.binaries.ffprobePath ?? ""); 
  const [message, setMessage] = useState("");
  
  useEffect(() => { setFfmpegPath(settings?.binaries.ffmpegPath ?? ""); setFfprobePath(settings?.binaries.ffprobePath ?? ""); }, [settings]);
  if (!settings) return <div className="panel muted">Načítám nastavení…</div>;
  
  return <section className="settings-page">
    <div className="panel">
      <h2>Anthropic API</h2>
      <p className="muted">Claude.ai předplatné není API klíč. API je samostatná služba s vlastním účtováním tokenů.</p>
      <div className="key-status"><span className={settings.hasAnthropicKey ? "dot ok" : "dot"} /> {settings.hasAnthropicKey ? "API klíč je nakonfigurován (hodnota se nezobrazuje)" : "API klíč není nakonfigurován"}</div>
      <input type="password" placeholder="sk-ant-…" value={key} onChange={(event) => setKey(event.target.value)} />
      <div className="button-row">
        <button className="primary" onClick={async () => { try { onChange(await window.videoForensics.settings.setKey(key)); setKey(""); setMessage("Klíč je uložen v Windows safeStorage."); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } }}><Icons.Refresh /> Uložit / změnit klíč</button>
        <button className="outline danger" onClick={async () => onChange(await window.videoForensics.settings.deleteKey())}><Icons.Trash /> Smazat klíč</button>
      </div>
    </div>
    <div className="panel">
      <h2>Lokální nástroje</h2>
      <p className="muted">Prázdná cesta používá ffprobe/ffmpeg z resources/binaries nebo systémového PATH.</p>
      <Label>ffprobe cesta<input value={ffprobePath} onChange={(event) => setFfprobePath(event.target.value)} /></Label>
      <Label>ffmpeg cesta<input value={ffmpegPath} onChange={(event) => setFfmpegPath(event.target.value)} /></Label>
      <div className="button-row">
        <button className="primary" onClick={async () => { onChange(await window.videoForensics.settings.binaries({ ffmpegPath, ffprobePath })); setMessage("Cesty uloženy."); }}><Icons.Refresh /> Uložit cesty</button>
      </div>
      {message && <p className="muted">{message}</p>}
    </div>
  </section>;
}

function formatBytes(value: number) { if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
