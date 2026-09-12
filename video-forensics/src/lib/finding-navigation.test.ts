import assert from "node:assert/strict";
import test from "node:test";
import { canSeekToFinding, seekVideoToFinding } from "./finding-navigation.ts";

test("zobrazí ovládání posunu jen pro video s platným časem", () => {
  assert.equal(canSeekToFinding("video", 12.5), true);
  assert.equal(canSeekToFinding("image", 12.5), false);
  assert.equal(canSeekToFinding("video", null), false);
});

test("posune přehrávač na čas nálezu a spustí ho", () => {
  let played = false;
  let scrolled = false;
  const video = {
    currentTime: 0,
    play: () => { played = true; },
    scrollIntoView: () => { scrolled = true; },
  };

  assert.equal(seekVideoToFinding(video, 42.25), true);
  assert.equal(video.currentTime, 42.25);
  assert.equal(played, true);
  assert.equal(scrolled, true);
});