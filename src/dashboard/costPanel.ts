import {
  modelCostUsd,
  totalCostUsd,
  totalCalls,
  chatPrice,
  reasonerPrice,
} from '../shared/aiCost.js';
import type { AiUsage, AiPrices, ModelUsage, ModelPrice } from '../shared/aiCost.js';

// Renders the Cost tab: AI-evaluation spend estimated from tracked token usage,
// shown in USD and MYR. Presentation only — it reports edits (FX rate, prices,
// reset) through callbacks; the dashboard owns persistence.

interface CostPanelOpts {
  usage: AiUsage;
  prices: AiPrices;
  usdToMyr: number;
  onRate: (n: number) => void;
  onPrices: (p: AiPrices) => void;
  onReset: () => void;
}

const money = (n: number, prefix: string): string =>
  prefix +
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 4 : 2 });

const tokens = (n: number): string => n.toLocaleString('en-US');

export function renderCostPanel(container: HTMLElement, o: CostPanelOpts): void {
  const usd = totalCostUsd(o.usage, o.prices);
  const myr = usd * o.usdToMyr;

  const row = (label: string, m: ModelUsage, p: ModelPrice): string =>
    '<tr><td>' +
    label +
    '</td><td class="num">' +
    m.calls +
    '</td><td class="num">' +
    tokens(m.inputTokens) +
    '</td><td class="num">' +
    tokens(m.cachedInputTokens) +
    '</td><td class="num">' +
    tokens(m.outputTokens) +
    '</td><td class="num">' +
    money(modelCostUsd(m, p), '$') +
    '</td></tr>';

  container.innerHTML = `
    <div class="cost-totals">
      <div class="cost-big">
        <span class="cost-cur">USD</span>
        <span class="cost-amt">${money(usd, '$')}</span>
      </div>
      <div class="cost-big">
        <span class="cost-cur">MYR</span>
        <span class="cost-amt">${money(myr, 'RM ')}</span>
      </div>
      <div class="cost-rate">
        <label class="side-lab" for="fxRate">USD → MYR rate</label>
        <input type="number" id="fxRate" class="side-inp" min="0" step="0.01" value="${o.usdToMyr}" />
      </div>
    </div>

    <div class="cost-sub">${totalCalls(o.usage)} AI evaluation call(s) tracked</div>

    <div class="table-scroll">
      <table class="cand cost-table">
        <thead><tr>
          <th>Model</th><th class="num">Calls</th><th class="num">Input tokens</th>
          <th class="num">of which cached</th><th class="num">Output tokens</th><th class="num">Est. USD</th>
        </tr></thead>
        <tbody>
          ${row('⚡ deepseek-chat', o.usage.chat, chatPrice(o.prices))}
          ${row('🧠 deepseek-reasoner', o.usage.reasoner, reasonerPrice(o.prices))}
        </tbody>
      </table>
    </div>

    <details class="cost-prices">
      <summary>Pricing (USD per 1M tokens)</summary>
      <div class="cost-price-grid">
        <label>chat · input (miss)<input type="number" id="pChatIn" class="side-inp" min="0" step="0.01" value="${o.prices.chatIn}" /></label>
        <label>chat · input (cache hit)<input type="number" id="pChatCached" class="side-inp" min="0" step="0.01" value="${o.prices.chatCached}" /></label>
        <label>chat · output<input type="number" id="pChatOut" class="side-inp" min="0" step="0.01" value="${o.prices.chatOut}" /></label>
        <label>reasoner · input (miss)<input type="number" id="pReasonerIn" class="side-inp" min="0" step="0.01" value="${o.prices.reasonerIn}" /></label>
        <label>reasoner · input (cache hit)<input type="number" id="pReasonerCached" class="side-inp" min="0" step="0.01" value="${o.prices.reasonerCached}" /></label>
        <label>reasoner · output<input type="number" id="pReasonerOut" class="side-inp" min="0" step="0.01" value="${o.prices.reasonerOut}" /></label>
      </div>
    </details>

    <div class="cost-foot">
      <button id="costReset" class="tbtn ghost danger-ghost">↺ Reset counters</button>
      <span class="cost-note">Estimate from token usage × the prices above. Verify against your DeepSeek billing.</span>
    </div>
  `;

  const el = <T extends HTMLElement>(id: string): T => container.querySelector('#' + id) as T;

  el<HTMLInputElement>('fxRate').addEventListener('change', (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (Number.isFinite(v) && v >= 0) o.onRate(v);
  });

  const priceInput = (id: string, key: keyof AiPrices): void => {
    el<HTMLInputElement>(id).addEventListener('change', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (Number.isFinite(v) && v >= 0) o.onPrices({ ...o.prices, [key]: v });
    });
  };
  priceInput('pChatIn', 'chatIn');
  priceInput('pChatCached', 'chatCached');
  priceInput('pChatOut', 'chatOut');
  priceInput('pReasonerIn', 'reasonerIn');
  priceInput('pReasonerCached', 'reasonerCached');
  priceInput('pReasonerOut', 'reasonerOut');

  el<HTMLButtonElement>('costReset').addEventListener('click', o.onReset);
}
