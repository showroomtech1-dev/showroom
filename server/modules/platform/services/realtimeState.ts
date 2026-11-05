// Whether this process has a Socket.io server attached (long-running server yes, Vercel function no).
let enabled = false;

export function setRealtimeEnabled(value: boolean): void {
  enabled = value;
}

export function realtimeEnabled(): boolean {
  return enabled;
}
