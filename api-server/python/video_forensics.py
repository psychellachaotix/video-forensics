#!/usr/bin/env python3
"""Isolated, deterministic technical checks for the video forensics pipeline."""

from __future__ import annotations

import json
import logging
import math
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
import time

logging.basicConfig(level=logging.INFO, format="%(message)s")
LOGGER = logging.getLogger("video_forensics")

import cv2
import numpy as np
from scenedetect import ContentDetector, SceneManager, open_video


StepResult = dict[str, Any]


@dataclass
class Context:
    source: Path
    probe: dict[str, Any]
    duration: float
    fps: float
    frames: list[tuple[float, np.ndarray]]


def timestamp(seconds: float | None) -> str | None:
    if seconds is None or not math.isfinite(seconds):
        return None
    seconds = max(0, int(round(seconds)))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def finding(title: str, detail: str, severity: str = "low", at: float | None = None, **metrics: Any) -> StepResult:
    return {
        "title": title,
        "detail": detail,
        "severity": severity,
        "timestamp": timestamp(at),
        "timestampSeconds": at,
        "metrics": metrics,
    }


def run_json(command: list[str]) -> dict[str, Any]:
    completed = subprocess.run(command, check=True, capture_output=True, text=True, timeout=120)
    return json.loads(completed.stdout)


def probe_source(source: Path) -> dict[str, Any]:
    return run_json([
        "ffprobe", "-v", "error", "-show_format", "-show_streams",
        "-show_packets", "-select_streams", "v:0", "-of", "json", str(source),
    ])


def fraction(value: str | None) -> float:
    if not value or value == "0/0":
        return 0.0
    numerator, _, denominator = value.partition("/")
    return float(numerator) / max(float(denominator or 1), 1)


def sample_frames(source: Path, duration: float, fps: float, maximum: int = 80) -> list[tuple[float, np.ndarray]]:
    capture = cv2.VideoCapture(str(source))
    if not capture.isOpened():
        raise RuntimeError("OpenCV nedokázalo otevřít video stream.")
    count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    source_fps = capture.get(cv2.CAP_PROP_FPS) or fps or 25
    total_duration = duration or (count / source_fps if count else 0)
    wanted = min(maximum, max(12, int(total_duration * 2))) if total_duration else maximum
    indices = np.linspace(0, max(0, count - 1), wanted, dtype=int) if count else np.arange(wanted)
    result: list[tuple[float, np.ndarray]] = []
    for index in indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
        ok, frame = capture.read()
        if not ok:
            continue
        if frame.shape[1] > 640:
            scale = 640 / frame.shape[1]
            frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        result.append((float(index) / source_fps, frame))
    capture.release()
    if not result:
        raise RuntimeError("Z video streamu nebylo možné načíst žádný snímek.")
    return result


def metadata_step(ctx: Context) -> StepResult:
    streams = ctx.probe.get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
    if not video:
        raise RuntimeError("Soubor neobsahuje přehratelný video stream.")
    fmt = ctx.probe.get("format", {})
    tags = fmt.get("tags", {}) or {}
    stream_tags = [
        stream.get("tags", {}) or {}
        for stream in streams
        if stream.get("codec_type") in ("video", "audio")
    ]
    # Keep only metadata, never probe paths or packet payloads, in the API.
    candidate_tags: dict[str, Any] = {
        "format": {str(k): v for k, v in tags.items() if isinstance(v, (str, int, float, bool))},
        "streams": [
            {str(k): v for k, v in stream.items() if isinstance(v, (str, int, float, bool))}
            for stream in stream_tags
        ],
    }
    candidates: list[tuple[str, str]] = []
    for source, values in [("format", tags), *[(f"stream-{index}", value) for index, value in enumerate(stream_tags)]]:
        for key, value in values.items():
            if str(key).lower() in {"encoder", "software", "handler_name", "handler", "writing_library"} and value:
                candidates.append((source, str(value)))
    encoder = next((value for source, value in candidates if source == "format" and "encoder" in value.lower()), None)
    encoder = encoder or (candidates[0][1] if candidates else None)
    editor: tuple[str, str] | None = None
    patterns = [
        (("adobe premiere", "premiere pro", "adobe media encoder", "media encoder"), "Adobe Premiere/Media Encoder"),
        (("after effects", "adobe after effects"), "Adobe After Effects"),
        (("davinci resolve", "da vinci resolve", "blackmagic design"), "DaVinci Resolve"),
        (("final cut", "apple compressor"), "Final Cut/Compressor"),
        (("sony vegas", "vegas pro", "magix vegas"), "Vegas"),
        (("capcut",), "CapCut"),
        (("handbrake",), "HandBrake"),
        (("ffmpeg", "lavf"), "FFmpeg/Lavf"),
        (("imovie", "i movie"), "iMovie"),
    ]
    for source, value in candidates:
        lowered = value.lower()
        for needles, name in patterns:
            if any(needle in lowered for needle in needles):
                editor = (name, source)
                break
        if editor:
            break
    return {
        "container": fmt.get("format_name", "neuvedeno"),
        "codec": video.get("codec_name", "neuvedeno"),
        "duration": ctx.duration,
        "createdAt": tags.get("creation_time"),
        "modifiedAt": None,
        "encoder": encoder,
        "editingSoftware": {
            "detected": editor is not None,
            "name": editor[0] if editor else None,
            "source": editor[1] if editor else ("tag_absent" if not candidates else "no_match"),
            "rawEncoder": encoder,
            "confidence": "high" if editor else None,
            "evidence": next((value for source, value in candidates if editor and source == editor[1]), None),
        },
        "allMetadata": candidate_tags,
        "bitrate": int(fmt["bit_rate"]) if fmt.get("bit_rate") else None,
        "frameRate": video.get("r_frame_rate"),
        "resolution": f"{video.get('width')}×{video.get('height')}" if video.get("width") and video.get("height") else None,
        **finding("Metadata a přehratelnost ověřeny", "ffprobe úspěšně načetl kontejner a video stream."),
    }


def compression_step(ctx: Context) -> StepResult:
    fmt = ctx.probe.get("format", {})
    tags = fmt.get("tags", {})
    encoder = tags.get("encoder") or tags.get("ENCODER") or ""
    packet_sizes = np.array([int(packet["size"]) for packet in ctx.probe.get("packets", []) if packet.get("size")], dtype=float)
    coefficient = float(np.std(packet_sizes) / np.mean(packet_sizes)) if packet_sizes.size and np.mean(packet_sizes) else 0
    suspicious_editor = any(name in encoder.lower() for name in ("premiere", "davinci", "resolve", "handbrake", "final cut", "ffmpeg"))
    irregular = coefficient > 2.2
    suspicious = suspicious_editor or irregular
    details = []
    if suspicious_editor:
        details.append(f"Tag enkodéru uvádí exportní software „{encoder}“.")
    if irregular:
        details.append("Velikosti komprimovaných paketů vykazují výrazně nepravidelný průběh.")
    if not details:
        details.append("Tag enkodéru ani průběh velikostí paketů neukázaly silnou známku opakovaného exportu.")
    return finding(
        "Možná stopa po exportu" if suspicious else "Komprese bez výrazné anomálie",
        " ".join(details),
        "high" if suspicious_editor else "medium" if irregular else "low",
        encoder=encoder or None,
        packetVariation=round(coefficient, 3),
        packetCount=int(packet_sizes.size),
    )


def cuts_step(ctx: Context) -> StepResult:
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=27.0, min_scene_len=max(4, round(ctx.fps * 0.25))))
    scene_manager.detect_scenes(open_video(str(ctx.source)), show_progress=False)
    scene_times = [scene[0].seconds for scene in scene_manager.get_scene_list(start_in_scene=True)[1:]]
    differences: list[tuple[float, float]] = []
    previous = None
    for at, frame in ctx.frames:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        histogram = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
        cv2.normalize(histogram, histogram)
        if previous is not None:
            differences.append((at, float(cv2.compareHist(previous, histogram, cv2.HISTCMP_BHATTACHARYYA))))
        previous = histogram
    values = np.array([value for _, value in differences])
    threshold = max(0.48, float(np.median(values) + 3.5 * np.std(values))) if values.size else 1
    histogram_cuts = [(at, value) for at, value in differences if value >= threshold]
    cuts = [(at, 1.0) for at in scene_times] or histogram_cuts
    strongest = max(cuts, key=lambda item: item[1], default=(None, 0))
    return finding(
        "Nalezeny pravděpodobné střihy" if cuts else "Bez náhlých střihových přechodů",
        f"Histogramová analýza našla {len(cuts)} náhlých přechodů v {len(ctx.frames)} vzorcích.",
        "medium" if cuts else "low",
        strongest[0],
        cutCount=len(cuts),
        threshold=round(threshold, 3),
        strongestDifference=round(strongest[1], 3),
        cutTimes=[round(at, 3) for at, _ in cuts[:20]],
        detector="PySceneDetect ContentDetector",
    )


def copied_region_score(gray: np.ndarray) -> int:
    orb = cv2.ORB_create(nfeatures=700)
    points, descriptors = orb.detectAndCompute(gray, None)
    if descriptors is None or not points:
        return 0
    matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(descriptors, descriptors, k=3)
    copied = 0
    for candidates in matches:
        source = candidates[0].queryIdx
        for match in candidates[1:]:
            distance = np.linalg.norm(np.array(points[source].pt) - np.array(points[match.trainIdx].pt))
            if match.distance < 28 and distance > min(gray.shape) * 0.16:
                copied += 1
                break
    return copied


def frames_step(ctx: Context) -> StepResult:
    if not ctx.frames:
        raise RuntimeError("Vzorkované snímky nejsou dostupné.")
    noise: list[tuple[float, float]] = []
    ela: list[tuple[float, float]] = []
    copied: list[tuple[float, int]] = []
    hashes: list[tuple[float, np.ndarray]] = []
    for at, frame in ctx.frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        noise.append((at, float(np.std(gray.astype(float) - cv2.GaussianBlur(gray, (5, 5), 0)))))
        ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if ok:
            recompressed = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
            ela.append((at, float(np.mean(cv2.absdiff(frame, recompressed)))))
        tiny = cv2.resize(gray, (16, 16), interpolation=cv2.INTER_AREA)
        hashes.append((at, tiny > np.mean(tiny)))
    for at, frame in ctx.frames[:: max(1, len(ctx.frames) // 16)]:
        copied.append((at, copied_region_score(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))))
    noise_values = np.array([value for _, value in noise])
    median_noise = float(np.median(noise_values))
    noise_outliers = [(at, value) for at, value in noise if abs(value - median_noise) > max(2.5, float(np.std(noise_values) * 2.8))]
    duplicate_pairs = []
    for index, (at, frame_hash) in enumerate(hashes):
        for other_at, other_hash in hashes[: max(0, index - 2)]:
            if np.count_nonzero(frame_hash != other_hash) <= 5:
                duplicate_pairs.append((at, other_at))
                break
    ela_values = np.array([value for _, value in ela])
    ela_threshold = float(np.median(ela_values) + 3 * np.std(ela_values)) if ela_values.size else math.inf
    ela_outliers = [(at, value) for at, value in ela if value > ela_threshold and value > 2]
    copied_hits = [(at, score) for at, score in copied if score >= 8]
    candidates = [(at, "šum") for at, _ in noise_outliers] + [(at, "ELA") for at, _ in ela_outliers] + [(at, "kopírovaná oblast") for at, _ in copied_hits]
    strongest_at, strongest_type = min(candidates, default=(None, ""))
    suspicious = bool(candidates or duplicate_pairs)
    return finding(
        "Snímková analýza našla anomálie" if suspicious else "Snímky bez výrazné lokální anomálie",
        f"Odchylky šumu: {len(noise_outliers)}, ELA: {len(ela_outliers)}, možné kopírované oblasti: {len(copied_hits)}, opakované snímky: {len(duplicate_pairs)}.",
        "high" if copied_hits or ela_outliers else "medium" if suspicious else "low",
        strongest_at,
        strongestSignal=strongest_type or None,
        sampledFrames=len(ctx.frames),
        noiseOutliers=len(noise_outliers),
        elaOutliers=len(ela_outliers),
        copiedRegions=len(copied_hits),
        duplicateFrames=len(duplicate_pairs),
    )


def audio_step(ctx: Context) -> StepResult:
    command = [
        "ffmpeg", "-v", "error", "-i", str(ctx.source), "-map", "0:a:0",
        "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1",
    ]
    completed = subprocess.run(command, capture_output=True, timeout=180)
    if completed.returncode != 0:
        raise RuntimeError("Video neobsahuje analyzovatelnou zvukovou stopu.")
    samples = np.frombuffer(completed.stdout, dtype=np.float32)
    if samples.size < 8000:
        raise RuntimeError("Zvuková stopa je příliš krátká pro analýzu diskontinuit.")
    chunks = samples[: samples.size - samples.size % 2000].reshape(-1, 2000)
    rms = np.sqrt(np.mean(np.square(chunks), axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    jumps = np.abs(np.diff(db))
    jump_indexes = np.where(jumps > 18)[0]
    silent = np.where(db < -58)[0]
    clipped = float(np.mean(np.abs(samples) >= 0.995))
    clipped_indexes = np.where(np.abs(samples) >= 0.995)[0]
    at = (
        float(jump_indexes[0] + 1) * 0.25
        if jump_indexes.size
        else float(clipped_indexes[0]) / 8000
        if clipped_indexes.size and clipped > 0.002
        else None
    )
    suspicious = jump_indexes.size > 0 or clipped > 0.002
    return finding(
        "Zvuk obsahuje možné diskontinuity" if suspicious else "Zvuk bez výrazné diskontinuity",
        f"Náhlé změny hlasitosti: {jump_indexes.size}, tiché úseky: {silent.size}, ořezané vzorky: {clipped * 100:.3f} %.",
        "high" if clipped > 0.01 else "medium" if suspicious else "low",
        at,
        discontinuities=int(jump_indexes.size),
        silentChunks=int(silent.size),
        clippedRatio=round(clipped, 6),
    )


def colors_step(ctx: Context) -> StepResult:
    if not ctx.frames:
        raise RuntimeError("Vzorkované snímky nejsou dostupné.")
    measurements = []
    for at, frame in ctx.frames:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        measurements.append((at, float(np.mean(hsv[:, :, 1])), float(np.mean(hsv[:, :, 2]))))
    matrix = np.array([[saturation, value] for _, saturation, value in measurements])
    medians = np.median(matrix, axis=0)
    deviations = np.std(matrix, axis=0)
    outliers = [
        (at, saturation, value) for at, saturation, value in measurements
        if abs(saturation - medians[0]) > max(18, deviations[0] * 3)
        or abs(value - medians[1]) > max(22, deviations[1] * 3)
    ]
    at = outliers[0][0] if outliers else None
    return finding(
        "Nalezeny barevné anomálie" if outliers else "Barevný průběh je konzistentní",
        f"Analýza jasu a saturace označila {len(outliers)} z {len(measurements)} vzorků jako odlehlé.",
        "medium" if outliers else "low",
        at,
        outlierCount=len(outliers),
        medianSaturation=round(float(medians[0]), 2),
        medianBrightness=round(float(medians[1]), 2),
    )


def execute_step(name: str, callback: Callable[[Context], StepResult], ctx: Context) -> dict[str, Any]:
    started = time.monotonic()
    LOGGER.info(json.dumps({"event": "analysis_step_started", "step": name}))
    try:
        result = {"stepName": name, "stepStatus": "OK", "resultJson": callback(ctx), "errorMessage": None}
        LOGGER.info(json.dumps({"event": "analysis_step_finished", "step": name, "status": "OK", "durationMs": round((time.monotonic() - started) * 1000)}))
        return result
    except Exception as error:
        LOGGER.exception(json.dumps({"event": "analysis_step_failed", "step": name, "durationMs": round((time.monotonic() - started) * 1000), "error": str(error)}))
        return {
            "stepName": name,
            "stepStatus": "NEDOSTUPNE",
            "resultJson": finding("Analytický krok není dostupný", str(error), "medium"),
            "errorMessage": str(error),
        }


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Je vyžadována cesta k videu."}))
        return 2
    source = Path(sys.argv[1])
    try:
        probe = probe_source(source)
        video = next((stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"), {})
        duration = float(probe.get("format", {}).get("duration") or 0)
        fps = fraction(video.get("avg_frame_rate") or video.get("r_frame_rate"))
        context = Context(source, probe, duration, fps, [])
    except Exception as error:
        rows = [
            {
                "stepName": name,
                "stepStatus": "CHYBA",
                "resultJson": None,
                "errorMessage": str(error),
            }
            for name in ("metadata", "komprese", "strihy", "snimky", "audio", "barvy")
        ]
        print(json.dumps({"steps": rows}, ensure_ascii=False))
        return 0
    try:
        context.frames = sample_frames(source, duration, fps)
    except Exception:
        context.frames = []
    steps = [
        execute_step("metadata", metadata_step, context),
        execute_step("komprese", compression_step, context),
        execute_step("strihy", cuts_step, context),
        execute_step("snimky", frames_step, context),
        execute_step("audio", audio_step, context),
        execute_step("barvy", colors_step, context),
    ]
    print(json.dumps({"steps": steps}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())