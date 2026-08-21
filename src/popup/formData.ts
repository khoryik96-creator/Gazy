import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
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
  [dom.jdInput, dom.keywordsInput, dom.booleanRuleInput, dom.countryFilterInput].forEach((input) => {
    input.addEventListener('input', saveFormData);
  });
  void loadFormData();
}

export function clearFormData(): void {
  dom.jdInput.value = '';
  dom.keywordsInput.value = '';
  dom.booleanRuleInput.value = '';
  dom.countryFilterInput.value = '';
}
