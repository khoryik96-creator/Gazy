import { DEEPSEEK_API_URL } from '../shared/constants.js';
import { buildEvaluationMessages, parseEvaluationResponse } from '../shared/aiEvaluation.js';
/**
 * Sends one profile to DeepSeek's OpenAI-compatible chat-completions endpoint
 * and returns the parsed evaluation. Throws on transport/HTTP/parse errors so
 * the engine can record a per-profile failure without aborting the run.
 */
export async function evaluateProfile({ apiKey, model, jd, profileText, }) {
    const { system, user } = buildEvaluationMessages(jd, profileText);
    const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
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
        }),
    });
    const data = (await res.json());
    if (!res.ok) {
        const detail = data.error?.message || res.statusText || 'request failed';
        throw new Error('DeepSeek ' + String(res.status) + ': ' + detail);
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('DeepSeek returned an empty response.');
    return parseEvaluationResponse(content);
}
