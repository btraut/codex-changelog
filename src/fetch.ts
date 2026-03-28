export type FetchFn = (
  input: Parameters<typeof globalThis.fetch>[0],
  init?: Parameters<typeof globalThis.fetch>[1]
) => ReturnType<typeof globalThis.fetch>;
