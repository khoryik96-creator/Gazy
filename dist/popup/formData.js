import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
export function saveFormData() {
    void setStorage({
        formData: {
            jd: dom.jdInput.value,
            keywords: dom.keywordsInput.value,
            booleanRule: dom.booleanRuleInput.value,
            country: dom.countryFilterInput.value,
        },
    });
}
async function loadFormData() {
    const { formData } = (await getStorage(['formData']));
    if (!formData)
        return;
    if (formData.jd)
        dom.jdInput.value = formData.jd;
    if (formData.keywords)
        dom.keywordsInput.value = formData.keywords;
    if (formData.booleanRule)
        dom.booleanRuleInput.value = formData.booleanRule;
    if (formData.country)
        dom.countryFilterInput.value = formData.country;
}
export function initFormPersistence() {
    [dom.jdInput, dom.keywordsInput, dom.booleanRuleInput, dom.countryFilterInput].forEach((input) => {
        input.addEventListener('input', saveFormData);
    });
    void loadFormData();
}
export function clearFormData() {
    dom.jdInput.value = '';
    dom.keywordsInput.value = '';
    dom.booleanRuleInput.value = '';
    dom.countryFilterInput.value = '';
}
