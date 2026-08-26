import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
import { COUNTRIES, canonicalCountry } from '../shared/countries.js';
import type { Template } from '../shared/types.js';

export function saveFormData(): void {
  void setStorage({
    formData: {
      jd: dom.jdInput.value,
      keywords: dom.keywordsInput.value,
      booleanRule: dom.booleanRuleInput.value,
      country: dom.countryFilterInput.value,
    },
  });
}

async function loadFormData(): Promise<void> {
  const { formData } = (await getStorage(['formData'])) as { formData?: Template };
  if (!formData) return;
  if (formData.jd) dom.jdInput.value = formData.jd;
  if (formData.keywords) dom.keywordsInput.value = formData.keywords;
  if (formData.booleanRule) dom.booleanRuleInput.value = formData.booleanRule;
  if (formData.country) dom.countryFilterInput.value = formData.country;
}

export function initFormPersistence(): void {
  [dom.jdInput, dom.keywordsInput, dom.booleanRuleInput, dom.countryFilterInput].forEach(
    (input) => {
      input.addEventListener('input', saveFormData);
    },
  );

  // Location combobox: fill the country dropdown and snap a typed country to its
  // canonical spelling (e.g. "malaysia" → "Malaysia").
  for (const name of COUNTRIES) {
    const opt = document.createElement('option');
    opt.value = name;
    dom.countryListEl.appendChild(opt);
  }
  dom.countryFilterInput.addEventListener('change', () => {
    const canon = canonicalCountry(dom.countryFilterInput.value);
    if (canon !== dom.countryFilterInput.value) {
      dom.countryFilterInput.value = canon;
      saveFormData();
    }
  });

  void loadFormData();
}

export function clearFormData(): void {
  dom.jdInput.value = '';
  dom.keywordsInput.value = '';
  dom.booleanRuleInput.value = '';
  dom.countryFilterInput.value = '';
}
