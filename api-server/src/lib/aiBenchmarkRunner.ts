export interface BenchmarkExecution {
  promptVersion: string;
}

export function assertCompatibleRunGroup(existingPromptVersions: readonly string[], promptVersion: string) {
  const incompatible = existingPromptVersions.filter((version) => version !== promptVersion);
  if (incompatible.length) {
    throw new Error(`Skupina už obsahuje jinou verzi promptu: ${[...new Set(incompatible)].join(", ")}`);
  }
}

export interface BenchmarkRunnerOptions<TFixture, TContext, TResult extends BenchmarkExecution> {
  fixtures: readonly TFixture[];
  promptVersion: string;
  runGroup: string;
  concurrency?: number;
  prepare: (fixture: TFixture) => Promise<TContext>;
  hasResult: (context: TContext, promptVersion: string, runGroup: string) => Promise<boolean>;
  execute: (fixture: TFixture) => Promise<TResult>;
  save: (context: TContext, result: TResult, runGroup: string) => Promise<void>;
  onSkip?: (fixture: TFixture) => void;
  onResult?: (fixture: TFixture, result: TResult) => void;
}

export async function runBenchmarkFixtures<TFixture, TContext, TResult extends BenchmarkExecution>(
  options: BenchmarkRunnerOptions<TFixture, TContext, TResult>,
) {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  for (let index = 0; index < options.fixtures.length; index += concurrency) {
    await Promise.all(options.fixtures.slice(index, index + concurrency).map(async (fixture) => {
      const context = await options.prepare(fixture);
      if (await options.hasResult(context, options.promptVersion, options.runGroup)) {
        options.onSkip?.(fixture);
        return;
      }
      const result = await options.execute(fixture);
      if (result.promptVersion !== options.promptVersion) {
        throw new Error(`Verze promptu se během benchmarku změnila: ${options.promptVersion} -> ${result.promptVersion}`);
      }
      await options.save(context, result, options.runGroup);
      options.onResult?.(fixture, result);
    }));
  }
}