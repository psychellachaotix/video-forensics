import { app, dialog } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaseRecord, Analysis } from "../shared/types.js";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);

export async function exportReport(record: CaseRecord, analysis: Analysis): Promise<string | null> {
  const findings = analysis.findings.map((finding) => `<li><strong>${escapeHtml(finding.title)}</strong> [${escapeHtml(finding.severity)}] — ${escapeHtml(finding.detail)}</li>`).join("");
  const steps = analysis.steps.map((step) => `<li>${escapeHtml(step.stepName)}: ${escapeHtml(step.stepStatus)} ${escapeHtml(step.detail ?? "")}</li>`).join("");
  const ai = analysis.interpret || analysis.verifier ? `<section><h2>AI kontrola</h2>${analysis.interpret ? `<h3>Interpret: ${escapeHtml(analysis.interpret.verdict)}</h3><p>${escapeHtml(analysis.interpret.reasoning)}</p>` : "<p>Interpret není dostupný.</p>"}${analysis.verifier ? `<h3>Verifier: ${escapeHtml(analysis.verifier.finalStatus)}</h3><p>${escapeHtml(analysis.verifier.comment)}</p>` : "<p>Verifier není dostupný.</p>"}<p>Tokeny: ${analysis.aiUsage?.inputTokens ?? 0} vstup / ${analysis.aiUsage?.outputTokens ?? 0} výstup. Odhad ceny: ${analysis.aiUsage?.estimatedCostUsd === null ? "nedostupný pro neznámý model" : `$${(analysis.aiUsage?.estimatedCostUsd ?? 0).toFixed(4)}`}.</p></section>` : "";
  const errors = analysis.errors.length ? `<section><h2>Chyby a omezení</h2><ul>${analysis.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul></section>` : "";
  const html = `<!doctype html><html lang="cs"><meta charset="utf-8"><title>${escapeHtml(record.name)}</title><style>body{font:14px system-ui;background:#0b1014;color:#e5edf0;max-width:960px;margin:40px auto;line-height:1.55}h1,h2{color:#64e5d0}section{border:1px solid #263840;padding:18px;margin:16px 0}code,pre{white-space:pre-wrap;color:#a7bbc0}</style><h1>Video Forensics — ${escapeHtml(record.name)}</h1><p>Lokální forenzní report · ${escapeHtml(analysis.completedAt ?? analysis.startedAt)}</p>${ai}<section><h2>Technická zjištění</h2><ul>${findings || "<li>Žádná zjištění.</li>"}</ul></section><section><h2>Pipeline</h2><ul>${steps}</ul><pre>${escapeHtml(JSON.stringify(analysis.metadata, null, 2))}</pre></section>${errors}</html>`;
  const internalPath = path.join(app.getPath("userData"), "cases", record.id, "reports", `${analysis.id}.html`);
  await fs.mkdir(path.dirname(internalPath), { recursive: true });
  await fs.writeFile(internalPath, html, "utf8");
  const destination = await dialog.showSaveDialog({ title: "Exportovat HTML report", defaultPath: `${record.name.replace(/[^a-z0-9-_]+/gi, "_")}-report.html`, filters: [{ name: "HTML", extensions: ["html"] }] });
  if (destination.canceled || !destination.filePath) return null;
  await fs.copyFile(internalPath, destination.filePath);
  return destination.filePath;
}