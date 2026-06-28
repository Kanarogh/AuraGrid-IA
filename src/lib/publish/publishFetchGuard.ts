/** Returns true when an in-flight fetch started at `requestGeneration` is outdated. */
export function isStaleFetch(requestGeneration: number, currentGeneration: number): boolean {
  return requestGeneration !== currentGeneration;
}
