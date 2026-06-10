export function resolveAtmanContextSource<T>(input: {
  uid?: string;
  clientAtman?: T;
  serverAtman?: T;
}): T | undefined {
  return input.uid ? input.serverAtman : input.clientAtman;
}
