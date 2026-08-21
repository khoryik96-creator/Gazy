import { dom } from './dom.js';
export function setStatus(message, type = 'info') {
    if (!dom.status)
        return;
    dom.status.textContent = message;
    dom.status.className =
        'status' + (type === 'error' ? ' error' : '') + (type === 'success' ? ' success' : '');
}
