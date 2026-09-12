import unittest

import cv2
import numpy as np

from image_forensics import copy_move, regional_noise


def control_image(seed: int = 7) -> np.ndarray:
    rng = np.random.default_rng(seed)
    image = rng.integers(25, 225, (600, 800, 3), dtype=np.uint8)
    image = cv2.GaussianBlur(image, (0, 0), 2)
    for index in range(30):
        center = (int(rng.integers(20, 780)), int(rng.integers(20, 580)))
        cv2.circle(image, center, int(rng.integers(5, 24)), tuple(int(value) for value in rng.integers(10, 245, 3)), -1)
    return image


class ImageForensicsThresholdTests(unittest.TestCase):
    def test_original_has_no_copy_move_candidate(self):
        result = copy_move(control_image())
        self.assertEqual(result["candidatePairs"], 0)
        self.assertLess(result["score"], 0.32)

    def test_copy_move_localizes_source_and_copy(self):
        image = control_image()
        image[330:480, 500:680] = image[90:240, 80:260]
        result = copy_move(image)
        self.assertGreaterEqual(result["candidatePairs"], 1)
        self.assertGreaterEqual(result["score"], 0.32)
        self.assertGreaterEqual(len(result["regions"]), 2)

    def test_original_noise_is_not_flagged(self):
        result = regional_noise(control_image())
        self.assertEqual(result["metrics"]["outlierCount"], 0)

    def test_noise_change_is_localized(self):
        image = control_image()
        rng = np.random.default_rng(99)
        patch = image[300:450, 400:600].astype(np.int16)
        patch += rng.normal(0, 24, patch.shape).astype(np.int16)
        image[300:450, 400:600] = np.clip(patch, 0, 255).astype(np.uint8)
        result = regional_noise(image)
        self.assertGreater(result["metrics"]["outlierCount"], 0)
        self.assertTrue(any(region["x"] < 600 and region["x"] + region["width"] > 400 for region in result["regions"]))


if __name__ == "__main__":
    unittest.main()