import assert from "node:assert/strict";
import test from "node:test";
import { assertCompatibleRunGroup, runBenchmarkFixtures } from "./aiBenchmarkRunner.ts";

test("odmítne pokračovat ve skupině jiné verze promptu", () => {
  assert.throws(() => assertCompatibleRunGroup(["v1.2"], "v1.3"), /v1.2/);
  assert.doesNotThrow(() => assertCompatibleRunGroup(["v1.3"], "v1.3"));
});

test("po přerušení pokračuje bez opakování placených AI volání", async () => {
  const fixtures = ["a", "b", "c"] as const;
  const saved = new Set<string>();
  const calls = new Map<string, number>();
  let interrupt = true;
  const invoke = () => runBenchmarkFixtures({
    fixtures,
    promptVersion: "v-test",
    runGroup: "verified-group",
    concurrency: 1,
    prepare: async (fixture) => fixture,
    hasResult: async (fixture) => saved.has(fixture),
    execute: async (fixture) => {
      calls.set(fixture, (calls.get(fixture) ?? 0) + 1);
      if (fixture === "b" && interrupt) {
        interrupt = false;
        throw new Error("simulované přerušení");
      }
      return { promptVersion: "v-test" };
    },
    save: async (fixture) => void saved.add(fixture),
  });

  await assert.rejects(invoke, /přerušení/);
  assert.deepEqual([...saved], ["a"]);
  await invoke();
  await invoke();
  assert.deepEqual([...saved], ["a", "b", "c"]);
  assert.equal(calls.get("a"), 1);
  assert.equal(calls.get("b"), 2);
  assert.equal(calls.get("c"), 1);
});

test("odmítne uložit výsledek jiné verze promptu", async () => {
  let saves = 0;
  await assert.rejects(runBenchmarkFixtures({
    fixtures: ["a"],
    promptVersion: "v1",
    runGroup: "group",
    prepare: async (fixture) => fixture,
    hasResult: async () => false,
    execute: async () => ({ promptVersion: "v2" }),
    save: async () => void saves++,
  }), /v1 -> v2/);
  assert.equal(saves, 0);
});