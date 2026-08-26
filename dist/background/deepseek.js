import { DEEPSEEK_API_URL, AI_RETRY_COUNT, AI_RETRY_DELAY_MIN_MS, AI_RETRY_DELAY_MAX_MS, } from '../shared/constants.js';
import { buildEvaluationMessages, parseEvaluationResponse } from '../shared/aiEvaluation.js';
import { isRetryableHttpStatus, backoffDelayMs } from '../shared/retry.js';
import { sleep } from '../shared/timing.js';
// Honour a Retry-After header (seconds, or an HTTP-date) if the server sends one;
// otherwise fall back to our exponential backoff. Returns milliseconds to wait.
function retryAfterMs(res, attempt) {
    const header = res.headers.get('retry-after');
    if (header) {
        const secs = Number(header);
        if (Number.isFinite(secs) && secs >= 0)
            return Math.min(secs * 1000, 30000);
        const when = Date.parse(header);
        if (!Number.isNaN(when))
            return Math.max(0, Math.min(when - Date.now(), 30000));
    }
    return backoffDelayMs(attempt, AI_RETRY_DELAY_MIN_MS, AI_RETRY_DELAY_MAX_MS);
}
/**
 * Sends one profile to DeepSeek's OpenAI-compatible chat-completions endpoint
 * and returns the parsed evaluation plus token usage.
 *
 * Retries on a 429 (rate limit) or transient 5xx — honouring a Retry-After
 * header when present, else exponential backoff — and on a network error, up to
 * AI_RETRY_COUNT attempts. A non-retryable HTTP error (e.g. 401 bad key) throws
 * at once. After the last attempt the error propagates so the engine records a
 * per-profile failure without aborting the whole run.
 */
export async function evaluateProfile({ apiKey, model, jd, profileText, }) {
    const { system, user } = buildEvaluationMessages(jd, profileText);
    const body = JSON.stringify({
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        // Ask for a raw JSON object; parseEvaluationResponse is still tolerant of
        // prose in case a model ignores this.
        response_format: { type: 'json_object' },
        temperature: 0.2,
        stream: false,
    });
    let lastError = new Error('DeepSeek request failed');
    for (let attempt = 0; attempt <= AI_RETRY_COUNT; attempt++) {
        let res;
        try {
            res = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + apiKey,
                },
                body,
            });
        }
        catch (e) {
            // Network error (offline, DNS, TLS) — transient, worth another try.
            lastError = e;
            if (attempt < AI_RETRY_COUNT) {
                await sleep(backoffDelayMs(attempt, AI_RETRY_DELAY_MIN_MS, AI_RETRY_DELAY_MAX_MS));
                continue;
            }
            throw lastError;
        }
        if (!res.ok) {
            const data = (await res.json().catch(() => ({})));
            const detail = data.error?.message || res.statusText || 'request failed';
            lastError = new Error('DeepSeek ' + String(res.status) + ': ' + detail);
            // Rate limit / transient server error → back off and retry; anything else
            // (bad key, bad request) won't improve on a retry, so fail now.
            if (isRetryableHttpStatus(res.status) && attempt < AI_RETRY_COUNT) {
                await sleep(retryAfterMs(res, attempt));
                continue;
            }
            throw lastError;
        }
        const data = (await res.json());
        const content = data.choices?.[0]?.message?.content;
        if (!content)
            throw new Error('DeepSeek returned an empty response.');
        return {
            entry: parseEvaluationResponse(content),
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            cachedTokens: data.usage?.prompt_cache_hit_tokens ?? 0,
        };
    }
    throw lastError;
}
