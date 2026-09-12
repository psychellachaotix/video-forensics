#!/usr/bin/env python3
"""Deterministic regional checks for still-image forensic analysis."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable

import cv2
import numpy as np


def region(x: int, y: int, width: int, height: int, score: float, label: str) -> dict[str, Any]:
    return {
        "x": int(x), "y": int(y), "width": int(width), "height": int(height),
        "score": round(float(np.clip(score, 0, 1)), 3), "label": label,
    }


def copy_move(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    scale = min(1.0, 1400 / max(height, width))
    work = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else gray
    orb = cv2.ORB_create(nfeatures=5000, scaleFactor=1.2, nlevels=8, edgeThreshold=15, patchSize=31, fastThreshold=12)
    keypoints, descriptors = orb.detectAndCompute(work, None)
    if descriptors is None or len(keypoints) < 20:
        return {
            "title": "Copy-Move: bez dostatku lokálních znaků",
            "detail": "Obraz neobsahuje dostatek rozlišitelných lokálních znaků pro spolehlivé porovnání.",
            "severity": "low", "score": 0, "regions": [], "candidatePairs": 0,
        }
    matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(descriptors, descriptors, k=5)
    vectors: list[tuple[int, int, int, int, float, float, float]] = []
    minimum_distance = max(24.0, min(work.shape) * 0.04)
    for source_index, neighbours in enumerate(matches):
        source = keypoints[source_index].pt
        for match in neighbours:
            if match.queryIdx == match.trainIdx or match.distance > 38:
                continue
            target = keypoints[match.trainIdx].pt
            spatial = float(np.hypot(source[0] - target[0], source[1] - target[1]))
            if spatial < minimum_distance:
                continue
            dx, dy = target[0] - source[0], target[1] - source[1]
            vectors.append((source_index, match.trainIdx, round(dx / 6), round(dy / 6), dx, dy, match.distance))
            break
    groups: dict[tuple[int, int], list[tuple[int, int, int, int, float, float, float]]] = {}
    for item in vectors:
        groups.setdefault((item[2], item[3]), []).append(item)
    candidates: list[dict[str, Any]] = []
    inverse_scale = 1 / scale
    for grouped in sorted(groups.values(), key=len, reverse=True):
        unique = {(item[0], item[1]) for item in grouped}
        if len(unique) < 6:
            continue
        source_points = np.array([keypoints[item[0]].pt for item in grouped])
        target_points = np.array([keypoints[item[1]].pt for item in grouped])
        if np.ptp(source_points[:, 0]) < 18 or np.ptp(source_points[:, 1]) < 18:
            continue
        margin = 18
        boxes = []
        for points, label in ((source_points, "Zdroj podobné oblasti"), (target_points, "Možná kopie oblasti")):
            x1, y1 = np.maximum(points.min(axis=0) - margin, 0)
            x2, y2 = np.minimum(points.max(axis=0) + margin, (work.shape[1] - 1, work.shape[0] - 1))
            boxes.append((int(x1 * inverse_scale), int(y1 * inverse_scale), int((x2 - x1) * inverse_scale), int((y2 - y1) * inverse_scale), label))
        mean_distance = float(np.mean([item[6] for item in grouped]))
        score = min(1.0, len(unique) / 22) * max(0.25, 1 - mean_distance / 70)
        candidates.append({"score": round(score, 3), "regions": [region(*box[:4], score, box[4]) for box in boxes], "matches": len(unique)})
        if len(candidates) == 3:
            break
    regions = [item for candidate in candidates if candidate["score"] >= 0.32 for item in candidate["regions"]]
    score = max((candidate["score"] for candidate in candidates), default=0)
    return {
        "title": "Copy-Move analýza dokončena",
        "detail": f"Nalezeno {len(regions) // 2} lokalizovaných párů se shodným posunem; skóre nejsilnějšího páru {score:.2f}.",
        "severity": "high" if score >= 0.65 else "medium" if score >= 0.32 else "low",
        "score": score, "regions": regions, "candidatePairs": len(regions) // 2,
        "thresholds": {"minimumMatches": 6, "minimumScore": 0.32, "maximumDescriptorDistance": 38},
    }


def regional_noise(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    height, width = gray.shape
    grid = 6 if min(height, width) >= 480 else 4
    residual = gray - cv2.GaussianBlur(gray, (0, 0), 1.2)
    cells: list[dict[str, Any]] = []
    for row in range(grid):
        for column in range(grid):
            x1, x2 = round(column * width / grid), round((column + 1) * width / grid)
            y1, y2 = round(row * height / grid), round((row + 1) * height / grid)
            patch = residual[y1:y2, x1:x2]
            intensity = gray[y1:y2, x1:x2]
            # Ignore strong edges so texture/content changes do not dominate sensor-noise estimates.
            gradients = cv2.magnitude(cv2.Sobel(intensity, cv2.CV_32F, 1, 0), cv2.Sobel(intensity, cv2.CV_32F, 0, 1))
            quiet = patch[gradients < np.percentile(gradients, 60)]
            sigma = float(np.median(np.abs(quiet - np.median(quiet))) * 1.4826) if quiet.size else 0
            cells.append({"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1, "sigma": sigma})
    values = np.array([cell["sigma"] for cell in cells])
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)) * 1.4826)
    denominator = max(mad, 0.75)
    regions = []
    for cell in cells:
        deviation = abs(cell["sigma"] - median) / denominator
        if deviation >= 3.5 and abs(cell["sigma"] - median) >= 1.5:
            score = min(1.0, deviation / 7)
            direction = "vyšší" if cell["sigma"] > median else "nižší"
            regions.append(region(cell["x"], cell["y"], cell["width"], cell["height"], score, f"{direction} lokální šum ({cell['sigma']:.2f} vs {median:.2f})"))
    regions.sort(key=lambda item: item["score"], reverse=True)
    regions = regions[:8]
    score = max((item["score"] for item in regions), default=0)
    return {
        "title": "Regionální analýza šumu dokončena",
        "detail": f"Porovnáno {len(cells)} oblastí; {len(regions)} překročilo robustní práh 3,5 MAD a minimální rozdíl 1,5.",
        "severity": "high" if score >= 0.75 else "medium" if regions else "low",
        "score": score, "regions": regions,
        "metrics": {"grid": grid, "medianSigma": round(median, 3), "robustSpread": round(mad, 3), "outlierCount": len(regions)},
        "thresholds": {"robustDeviation": 3.5, "minimumSigmaDifference": 1.5},
    }


def run_step(name: str, analyzer: Callable[[np.ndarray], dict[str, Any]], image: np.ndarray) -> dict[str, Any]:
    try:
        return {"stepName": name, "stepStatus": "OK", "resultJson": analyzer(image), "errorMessage": None}
    except Exception as error:
        return {"stepName": name, "stepStatus": "CHYBA", "resultJson": None, "errorMessage": f"{type(error).__name__}: {error}"}


def main() -> None:
    image = cv2.imread(str(Path(sys.argv[1])), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("OpenCV nedokázalo načíst obrázek.")
    print(json.dumps({"steps": [
        run_step("copy_move", copy_move, image),
        run_step("noise", regional_noise, image),
    ]}, ensure_ascii=False))


if __name__ == "__main__":
    main()