import { logger } from "./logger.ts";

export const PROMPT_VERSION = "v1.3";
const RETRY_DELAYS_MS = process.env.NODE_ENV === "test" ? [0, 0] as const : [2_000, 5_000] as const;
export const DEFAULT_PRICING_MAX_AGE_DAYS = 90;

type AiProvider = "Anthropic" | "OpenAI";

interface AiModelConfig {
  provider: AiProvider;
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  pricingVerifiedAt: string;
  pricingSource: string;
}

export const AI_MODEL_CONFIGS = {
  Anthropic: {
    "claude-sonnet-4-6": {
      provider: "Anthropic",
      model: "claude-sonnet-4-6",
      inputUsdPerMillion: 3,
      outputUsdPerMillion: 15,
      pricingVerifiedAt: "2026-09-11",
      pricingSource: "https://www.anthropic.com/pricing",
    },
  },
  OpenAI: {
    "gpt-5-mini": {
      provider: "OpenAI",
      model: "gpt-5-mini",
      inputUsdPerMillion: 0.25,
      outputUsdPerMillion: 2,
      pricingVerifiedAt: "2026-09-11",
      pricingSource: "https://openai.com/api/pricing/",
    },
  },
} as const satisfies Record<AiProvider, Record<string, AiModelConfig>>;

export interface PricingFreshness {
  stale: boolean;
  ageDays: number;
  maxAgeDays: number;
  verifiedAt: string;
  source: string;
}

export function getPricingFreshness(
  config: AiModelConfig,
  now = new Date(),
  maxAgeDays = DEFAULT_PRICING_MAX_AGE_DAYS,
): PricingFreshness {
  const verifiedAt = new Date(`${config.pricingVerifiedAt}T00:00:00.000Z`);
  if (Number.isNaN(verifiedAt.getTime())) {
    throw new Error(`Model "${config.model}" má neplatné datum ověření ceny.`);
  }
  const ageDays = Math.max(0, Math.floor((now.getTime() - verifiedAt.getTime()) / 86_400_000));
  return {
    stale: ageDays > maxAgeDays,
    ageDays,
    maxAgeDays,
    verifiedAt: config.pricingVerifiedAt,
    source: config.pricingSource,
  };
}

export function warnIfPricingIsStale(
  config: AiModelConfig,
  now = new Date(),
  maxAgeDays = Number(process.env.AI_PRICING_MAX_AGE_DAYS ?? DEFAULT_PRICING_MAX_AGE_DAYS),
): PricingFreshness {
  const effectiveMaxAgeDays = Number.isFinite(maxAgeDays) && maxAgeDays >= 0
    ? maxAgeDays
    : DEFAULT_PRICING_MAX_AGE_DAYS;
  const freshness = getPricingFreshness(config, now, effectiveMaxAgeDays);
  if (freshness.stale) {
    logger.error({
      event: "AI_PRICING_STALE",
      provider: config.provider,
      model: config.model,
      ...freshness,
    }, "POZOR: Cenová konfigurace AI je zastaralá; ověřte veřejný ceník před dalšími analýzami.");
  }
  return freshness;
}

export function getModelConfig(provider: AiProvider): AiModelConfig {
  const model = provider === "Anthropic"
    ? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
    : process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const config = (AI_MODEL_CONFIGS[provider] as Record<string, AiModelConfig>)[model];
  if (!config) {
    throw new Error(
      `Model "${model}" poskytovatele ${provider} nemá ověřenou konfiguraci cen. ` +
      "Doplňte model a jeho sazby do AI_MODEL_CONFIGS.",
    );
  }
  return config;
}

export function getSelectedProvider(): { provider: AiProvider; model: string; configured: boolean } {
  const hasAnthropicConfig = Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim() ||
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim(),
  );
  const provider: AiProvider = hasAnthropicConfig ? "Anthropic" : "OpenAI";
  const configured = provider === "Anthropic"
    ? Boolean(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim())
    : Boolean(process.env.OPENAI_API_KEY?.trim());
  return {
    provider,
    model: provider === "Anthropic"
      ? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
      : process.env.OPENAI_MODEL ?? "gpt-5-mini",
    configured,
  };
}

const INTERPRET_SYSTEM_PROMPT = `Jsi agent "Forenzní analyzátor videí", forenzní analytik specializující se na ověřování autenticity video záznamů.
Výsledná taxonomie je ORIGINAL (original capture), UPRAVENO (manual/editor
modification), UPRAVENO_AI (original/camera video with localized or partial
AI modification), CELE_AI (fully AI-generated/synthetic video) a NEJASNE
(insufficient or conflicting evidence). Použij právě jednu z těchto tříd.
Tvým úkolem je vyhodnotit, zda bylo video jakkoliv manipulováno (stříháno,
re-exportováno, zpomaleno/zrychleno, upraveno v editoru, obsahuje vymazané
nebo vložené prvky, upravený zvuk, atd.), nebo zda se jedná o originální,
nezměněný záznam přímo ze zdrojového zařízení.

Dostaneš strukturovaná data z automatizovaných analytických nástrojů:
- METADATA: informace o souboru (datum vytvoření/úpravy, použitý software,
  kodek, časové značky)
- KOMPRESE: indikátory dvojité komprese nebo nekonzistentního bitrate
- STŘIHY: seznam časových značek, kde detekční algoritmus našel možné
  sestřihy nebo nepřirozené přechody mezi scénami
- SNÍMKY: popis vizuálních anomálií (klonované oblasti, nesedící stíny,
  šumové nesrovnalosti) na konkrétních snímcích
- AUDIO: informace o synchronizaci zvuku a obrazu, nespojitosti ve waveformu
- BARVY: histogramové rozdíly mezi segmenty videa

Pracuj výhradně s předloženými strukturovanými daty. Chybějící nebo
NEDOSTUPNE výsledky nejsou důkazem a nesmíš je domýšlet.

RUBRIKA PRO VYHODNOCENÍ (přesně jedna třída):
1. Neuváděj závěr "upraveno" na základě jediné slabé indicie – hledej
   shodu (konvergenci) napříč více kategoriemi dat.
2. Rozliš mezi běžnými technickými artefakty (např. přirozená komprese
   kamery, autofocus, změna osvětlení kvůli mračnu) a skutečnými
   indiciemi manipulace.
3. Pokud metadata ukazují editační software (Premiere, DaVinci,
   HandBrake, FFmpeg s re-encode značkou apod.), považuj to za silnou
   indicii, ale ne automaticky za jistotu – zkontroluj, zda tomu
   odpovídají i další nálezy.
4. Pokud jsou data protichůdná nebo nedostatečná pro jasný závěr,
   otevřeně to přiznej – nehádej "na jistotu".
5. Buď konkrétní: neříkej jen "video je upravené", ale popiš JAK
   (konkrétní typ manipulace) a KDE (časový úsek/snímek).
6. ORIGINAL je původní zachycení: běžné kamerové/exportní artefakty,
   komprese, autofocus, změna osvětlení, šum a chybějící provenance nejsou
   důkaz manipulace. UPRAVENO je ruční/tradiční NLE zásah (střihy, změna
   rychlosti, audio overlay, titulky, korekce či re-encoding); re-export sám
   o sobě není důkaz AI.
7. UPRAVENO_AI vyžaduje původní/kamerovou bázi a lokalizovanou či částečnou
   generativní změnu (fill/inpainting, výměna obličeje/hlasu, syntetický
   insert nebo AI denoise/upscale měnící obsah). CELE_AI vyžaduje důkaz
   plně syntetického původu celého videa a časové/fyzické/obsahové
   nesrovnalosti v celém záznamu nejsou samy o sobě důkaz generátoru.
8. Pro UPRAVENO_AI a CELE_AI vyžaduj více nezávislých konvergentních signálů,
   s výjimkou silného kryptografického/provenance/generátorového důkazu,
   který popisuje rozsah změny. Metadata pouze se jménem AI nástroje
   nedokazují, že celé video je AI. Pokud nelze rozlišit manuální a AI změnu,
   nebo jsou důkazy v konfliktu, vrať NEJASNE místo hádání.

VÝSTUP – odpověz VÝHRADNĚ v tomto JSON formátu, bez dalšího textu:
{
   "verdikt": "ORIGINAL" | "UPRAVENO" | "UPRAVENO_AI" | "CELE_AI" | "NEJASNE",
  "jistota_procenta": <0-100>,
  "typ_manipulace": ["seznam nalezených typů"],
  "casove_useky": ["seznam podezřelých časových značek s krátkým popisem"],
  "zduvodneni": "podrobné vysvětlení opřené o konkrétní data",
  "nejasnosti": "co zůstává nejisté nebo protichůdné, pokud něco"
}`;

const VERIFIER_SYSTEM_PROMPT = `Jsi agent "Forenzní ověřovatel videí", nezávislý forenzní auditor. Tvým úkolem NENÍ provádět vlastní novou
analýzu videa od nuly. Dostaneš:
1. Stejná surová data, jaká měl k dispozici jiný analytik (metadata,
   komprese, střihy, snímky, audio, barvy)
2. Jeho závěr ve formátu JSON (verdikt, jistota, typ manipulace,
   zdůvodnění)

Tvým úkolem je KRITICKY zkontrolovat, zda tento závěr skutečně logicky
vyplývá z předložených dat.
Neprováděj vlastní novou analýzu od nuly a nevymýšlej důkazy, které v
surových datech nejsou. NEDOSTUPNE není důkaz.

POSTUPUJ TAKTO:
1. Projdi každé tvrzení v poli "zduvodneni" a "typ_manipulace" a ověř,
   zda je podložené konkrétními daty z metadat/komprese/střihů/snímků/
   audia/barev.
2. Hledej případy, kdy analytik:
   - vyvodil silný závěr ze slabé nebo nejednoznačné indicie,
   - ignoroval data, která jeho závěru odporují,
   - přiřadil moc vysokou jistotu vzhledem k síle důkazů,
   - naopak přehlédl silnou indicii manipulace, kterou data obsahují.
3. Vždy audituj vybranou třídu proti alternativám: běžné kamerové artefakty
   nejsou úprava; NLE střih/re-encoding/audio overlay podporují UPRAVENO,
   nikoli automaticky AI; lokální inpainting, výměna tváře/hlasu či
   syntetický insert podporují UPRAVENO_AI; plně syntetická provenance a
   celkové časové/fyzické/obsahové rozpory podporují CELE_AI. Re-export,
   chybějící provenance ani samotné jméno AI nástroje CELE_AI nepotvrzují.
4. U UPRAVENO_AI a CELE_AI vyžaduj více nezávislých konvergentních signálů,
   kromě silného kryptografického/provenance/generátorového důkazu. Když data
   nerozliší manuální a AI změnu, správná třída je NEJASNE.
5. Pokud zjištěné rozpory materiálně odporují vybrané třídě, nemůžeš ji
   potvrdit: nastav shoda_s_analytikem false a finalni_status SPORNE nebo
   NEJISTE. Potvrzení vyžaduje audit relevantních alternativ.
6. Zkontroluj, zda podezřelé časové úseky analytika odpovídají časovým
   značkám v surových datech. Nepotvrzuj časový údaj, který data neobsahují.
7. Nehodnoť "hezky napsáno" nebo styl – hodnoť pouze logickou a faktickou
   správnost vůči datům.
8. Buď skeptický vůči přehnaně sebejistým závěrům (jistota 90%+ vyžaduje
   opravdu silnou shodu více nezávislých indicií).

VÝSTUP – odpověz VÝHRADNĚ v tomto JSON formátu, bez dalšího textu:
{
  "shoda_s_analytikem": true | false,
  "upravena_jistota_procenta": <0-100>,
  "rozpory": ["seznam konkrétních rozporů mezi daty a závěrem analytika"],
  "potvrzena_zjisteni": ["seznam dobře podložených tvrzení analytika"],
  "finalni_status": "POTVRZENO" | "SPORNE" | "NEJISTE",
  "komentar": "stručné shrnutí, proč jsi dospěl k tomuto statusu"
}

Pokud "shoda_s_analytikem" je false NEBO "rozpory" obsahuje alespoň
jednu položku, nastav "finalni_status" na "SPORNE" nebo "NEJISTE" –
nikdy nepotvrzuj závěr, který sis sám nevěrohodnil.`;

const IMAGE_INTERPRET_SYSTEM_PROMPT = `Jsi forenzní analytik specializující se na ověřování autenticity statických obrázků a fotografií.
Vyhodnoť pouze strukturovaná data z METADATA/EXIF, ELA, COPY-MOVE a ŠUMU. NEDOSTUPNE
není nález a nikdy nevymýšlej chybějící data. Hledej shodu napříč nezávislými kategoriemi,
rozlišuj běžnou JPEG kompresi a zpracování fotoaparátem od manipulace a konkrétně popiš
podezřelou oblast, pokud ji data uvádějí. Odpověz výhradně JSON:
{"verdikt":"ORIGINAL"|"UPRAVENO"|"UPRAVENO_AI"|"CELE_AI"|"NEJASNE","jistota_procenta":0-100,
"typ_manipulace":["..."],"podezrele_oblasti":["..."],"zduvodneni":"...","nejasnosti":"..."}`;

const IMAGE_VERIFIER_SYSTEM_PROMPT = `Jsi nezávislý forenzní auditor statických obrázků. Zkontroluj, zda závěr analytika
logicky vyplývá ze stejných dat METADATA/EXIF, ELA, COPY-MOVE a ŠUMU. NEDOSTUPNE není důkaz.
Buď skeptický k vysoké jistotě a rozporům. Odpověz výhradně JSON:
{"shoda_s_analytikem":true|false,"upravena_jistota_procenta":0-100,
"rozpory":["..."],"potvrzena_zjisteni":["..."],
"finalni_status":"POTVRZENO"|"SPORNE"|"NEJISTE","komentar":"..."}`;

type AgentType = "INTERPRET" | "VERIFIER";

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AgentResult {
  result: Record<string, unknown>;
  usage: AgentUsage;
  retries: number;
}

export interface AgentCompletion {
  result?: Record<string, unknown>;
  usage: AgentUsage;
  retries: number;
}

export interface DualAiResult {
  promptVersion: string;
  interpret: AgentResult;
  verifier: AgentResult;
}

export function deriveVerifiedAiVerdict(ai: DualAiResult) {
  if (ai.verifier.result.finalni_status !== "POTVRZENO") {
    return { verdict: "NEJASNE" as const, confidence: 0 };
  }
  return {
    verdict: ai.interpret.result.verdikt as "ORIGINAL" | "UPRAVENO" | "UPRAVENO_AI" | "CELE_AI" | "NEJASNE",
    confidence: Number(ai.verifier.result.upravena_jistota_procenta ?? ai.interpret.result.jistota_procenta ?? 0),
  };
}

export class AiAnalysisError extends Error {
  readonly agent: AgentType;
  readonly retries: number;
  readonly completedInterpret?: AgentCompletion;
  readonly completedVerifier?: AgentCompletion;

  constructor(
    message: string,
    agent: AgentType,
    retries: number,
    completedInterpret?: AgentCompletion,
    completedVerifier?: AgentCompletion,
  ) {
    super(message);
    this.name = "AiAnalysisError";
    this.agent = agent;
    this.retries = retries;
    this.completedInterpret = completedInterpret;
    this.completedVerifier = completedVerifier;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryable(status: number | undefined, error: unknown) {
  if (
    error instanceof Error &&
    /insufficient_quota|credit_balance_exhausted/i.test(error.message)
  ) {
    return false;
  }
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  return error instanceof TypeError ||
    (error instanceof Error && /network|fetch|socket|timeout|connection/i.test(error.message));
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const value: unknown = JSON.parse(cleaned);
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("AI odpověď není JSON objekt.");
  }
  return value as Record<string, unknown>;
}

async function callAgent(agent: AgentType, system: string, content: string): Promise<AgentResult> {
  // Keep Anthropic first when it is explicitly configured: this makes the
  // existing Replit integration (and callers with both keys) deterministic.
  const hasAnthropicConfig = Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY?.trim() ||
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim(),
  );
  const provider: AiProvider = hasAnthropicConfig ? "Anthropic" : "OpenAI";
  const apiKey = hasAnthropicConfig
    ? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiAnalysisError(`${provider} API není nakonfigurováno.`, agent, 0);
  let modelConfig: AiModelConfig;
  try {
    modelConfig = getModelConfig(provider);
    warnIfPricingIsStale(modelConfig);
  } catch (error) {
    throw new AiAnalysisError(
      error instanceof Error ? error.message : "Model nemá ověřenou konfiguraci cen.",
      agent,
      0,
    );
  }
  const anthropicBaseUrl = (process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");

  let retries = 0;
  for (;;) {
    let status: number | undefined;
    let providerRequestId: string | undefined;
    const startedAt = Date.now();
    try {
      logger.info({ agent, provider, model: modelConfig.model, attempt: retries + 1 }, "AI agent request started");
      const response = await fetch(
        hasAnthropicConfig ? `${anthropicBaseUrl}/v1/messages` : "https://api.openai.com/v1/chat/completions",
        {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(hasAnthropicConfig
            ? { "anthropic-version": "2023-06-01", "x-api-key": apiKey }
            : { authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(hasAnthropicConfig
          ? {
              model: modelConfig.model,
              max_tokens: 8192,
              system,
              messages: [{ role: "user", content }],
            }
          : {
              model: modelConfig.model,
              max_completion_tokens: 8192,
              messages: [
                { role: "system", content: system },
                { role: "user", content },
              ],
              response_format: { type: "json_object" },
            }),
        signal: AbortSignal.timeout(90_000),
        },
      );
      status = response.status;
      providerRequestId = response.headers.get("request-id") ?? response.headers.get("x-request-id") ?? undefined;
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`${provider} API vrátilo HTTP ${response.status}.`);
      }
      const payload = await response.json() as {
        content?: Array<{ type?: string; text?: string }>;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };
      const text = hasAnthropicConfig
        ? payload.content?.find((block) => block.type === "text")?.text
        : payload.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${provider} API nevrátilo textovou odpověď.`);
      const inputTokens = hasAnthropicConfig
        ? payload.usage?.input_tokens ?? 0
        : payload.usage?.prompt_tokens ?? 0;
      const outputTokens = hasAnthropicConfig
        ? payload.usage?.output_tokens ?? 0
        : payload.usage?.completion_tokens ?? 0;
      const completion: AgentCompletion = {
        usage: {
          inputTokens,
          outputTokens,
          costUsd: Number(((
            inputTokens * modelConfig.inputUsdPerMillion +
            outputTokens * modelConfig.outputUsdPerMillion
          ) / 1_000_000).toFixed(6)),
        },
        retries,
      };
      logger.info({
        agent,
        provider,
        model: modelConfig.model,
        status,
        providerRequestId,
        durationMs: Date.now() - startedAt,
        retries,
        inputTokens,
        outputTokens,
      }, "AI agent request finished");
      try {
        completion.result = parseJson(text);
      } catch (error) {
        throw new AiAnalysisError(
          `${provider}: ${error instanceof Error ? error.message : "AI vrátila neplatný JSON."}`,
          agent,
          retries,
          agent === "INTERPRET" ? completion : undefined,
          agent === "VERIFIER" ? completion : undefined,
        );
      }
      return completion as AgentResult;
    } catch (error) {
      logger.warn({
        agent,
        provider,
        model: modelConfig.model,
        status,
        providerRequestId,
        durationMs: Date.now() - startedAt,
        attempt: retries + 1,
        retrying: retries < RETRY_DELAYS_MS.length && isRetryable(status, error),
        error: error instanceof Error ? error.message : "Neznámá chyba AI API.",
      }, "AI agent request failed");
      if (retries >= RETRY_DELAYS_MS.length || !isRetryable(status, error)) {
        if (error instanceof AiAnalysisError) throw error;
        throw new AiAnalysisError(
          `${provider} API: ${error instanceof Error ? error.message : "Neznámá chyba AI API."}`,
          agent,
          retries,
        );
      }
      await sleep(RETRY_DELAYS_MS[retries]);
      retries += 1;
    }
  }
}

export type AgentPhaseCallback = (agent: "INTERPRET" | "VERIFIER") => void | Promise<void>;

export async function runDualAiAnalysis(
  rawFindings: unknown,
  mediaType: "video" | "obrazek" = "video",
  onPhase?: AgentPhaseCallback,
): Promise<DualAiResult> {
  const rawJson = JSON.stringify(rawFindings, null, 2);
  const image = mediaType === "obrazek";
  await onPhase?.("INTERPRET");
  const interpret = await callAgent(
    "INTERPRET",
    image ? IMAGE_INTERPRET_SYSTEM_PROMPT : INTERPRET_SYSTEM_PROMPT,
    `Zde jsou nálezy z automatizované analýzy ${image ? "obrázku" : "videa"}:\n\n${rawJson}`,
  );
  try {
    interpret.result = normalizeInterpret(interpret.result);
  } catch (error) {
    throw new AiAnalysisError(
      error instanceof Error ? error.message : "Interpret vrátil neplatný výsledek.",
      "INTERPRET",
      interpret.retries,
      interpret,
    );
  }
  try {
    await onPhase?.("VERIFIER");
    const verifier = await callAgent(
      "VERIFIER",
      image ? IMAGE_VERIFIER_SYSTEM_PROMPT : VERIFIER_SYSTEM_PROMPT,
      `Surová data:\n${rawJson}\n\nZávěr analytika:\n${JSON.stringify(interpret.result, null, 2)}\n\nProveď audit.`,
    );
    try {
      verifier.result = normalizeVerifier(verifier.result);
    } catch (error) {
      throw new AiAnalysisError(
        error instanceof Error ? error.message : "Verifier vrátil neplatný výsledek.",
        "VERIFIER",
        verifier.retries,
        interpret,
        verifier,
      );
    }
    return { promptVersion: PROMPT_VERSION, interpret, verifier };
  } catch (error) {
    if (error instanceof AiAnalysisError) {
      throw new AiAnalysisError(
        error.message,
        error.agent,
        error.retries,
        interpret,
        error.completedVerifier,
      );
    }
    throw error;
  }
}

export function normalizeInterpret(result: Record<string, unknown>) {
  const verdict = result.verdikt;
  const confidence = result.jistota_procenta;
  if (!["ORIGINAL", "UPRAVENO", "UPRAVENO_AI", "CELE_AI", "NEJASNE"].includes(String(verdict))) {
    throw new Error("Interpret vrátil neplatný verdikt.");
  }
  if (
    typeof confidence !== "number" ||
    !Number.isInteger(confidence) ||
    confidence < 0 ||
    confidence > 100
  ) {
    throw new Error("Interpret vrátil neplatnou jistotu.");
  }
  const areas = result.casove_useky ?? result.podezrele_oblasti;
  if (
    !isStringArray(result.typ_manipulace) ||
    !isStringArray(areas) ||
    typeof result.zduvodneni !== "string" ||
    typeof result.nejasnosti !== "string"
  ) {
    throw new Error("Interpret vrátil neúplný nebo neplatný výsledek.");
  }
  return { ...result, casove_useky: areas, podezrele_oblasti: areas, verdict, confidence };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function normalizeVerifier(result: Record<string, unknown>) {
  const status = result.finalni_status;
  if (!["POTVRZENO", "SPORNE", "NEJISTE"].includes(String(status))) {
    throw new Error("Verifier vrátil neplatný finální status.");
  }
  const confidence = result.upravena_jistota_procenta;
  if (
    typeof result.shoda_s_analytikem !== "boolean" ||
    typeof confidence !== "number" ||
    !Number.isInteger(confidence) ||
    confidence < 0 ||
    confidence > 100 ||
    !isStringArray(result.rozpory) ||
    !isStringArray(result.potvrzena_zjisteni) ||
    typeof result.komentar !== "string"
  ) {
    throw new Error("Verifier vrátil neúplný nebo neplatný výsledek auditu.");
  }
  if (status === "POTVRZENO" && (
    result.shoda_s_analytikem !== true || result.rozpory.length > 0
  )) {
    throw new Error("Verifier vrátil POTVRZENO navzdory neshodě nebo rozporům.");
  }
  return { ...result, finalni_status: status as "POTVRZENO" | "SPORNE" | "NEJISTE" };
}

export function hasSufficientEvidence(findings: Array<{ stepStatus: string }>) {
  return findings.filter((finding) => finding.stepStatus !== "OK").length <= findings.length / 2;
}