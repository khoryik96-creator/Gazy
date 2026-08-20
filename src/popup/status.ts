import { dom } from './dom.js';

export type StatusType = 'info' | 'error' | 'success';

export function setStatus(message: string, type: StatusType = 'info'): void {
  if (!dom.status) return;
  dom.status.textContent = message;
  dom.status.className = 'status' + (type === 'error' ? ' error' : '') + (type === 'success' ? ' success' : '');
}
