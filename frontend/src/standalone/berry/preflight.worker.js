import { createBerryRuntime } from './runtime.js';

self.onmessage = async ({ data }) => {
  try {
    const runtime = await createBerryRuntime(() => {});
    self.postMessage({ diagnostics: runtime.compile(data.code) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
