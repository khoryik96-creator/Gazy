import { dom } from './dom.js';
import { getStorage, setStorage } from './storage.js';
import { setStatus } from './status.js';
import { saveFormData } from './formData.js';

export async function loadTemplateDropdown() {
  const { templates = {} } = await getStorage(['templates']);
  dom.templateSelect.innerHTML = '<option value="">-- Load Template --</option>';
  for (const name in templates) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dom.templateSelect.appendChild(opt);
  }
}

async function saveTemplate() {
  const name = prompt('Enter template name:');
  if (!name) return;

  const { templates = {} } = await getStorage(['templates']);
  if (templates[name] && !confirm(`Template "${name}" already exists. Overwrite?`)) return;

  templates[name] = {
    jd: dom.jdInput.value,
    keywords: dom.keywordsInput.value,
    booleanRule: dom.booleanRuleInput.value,
    country: dom.countryFilterInput.value,
  };
  await setStorage({ templates });
  await loadTemplateDropdown();
  setStatus('✅ Template saved: ' + name, 'success');
}

async function loadTemplate() {
  const name = dom.templateSelect.value;
  if (!name) {
    setStatus('Please select a template to load.', 'error');
    return;
  }

  const { templates = {} } = await getStorage(['templates']);
  const template = templates[name];
  if (!template) {
    setStatus('Template not found.', 'error');
    return;
  }

  dom.jdInput.value = template.jd || '';
  dom.keywordsInput.value = template.keywords || '';
  dom.booleanRuleInput.value = template.booleanRule || '';
  dom.countryFilterInput.value = template.country || '';
  saveFormData();
  setStatus('📂 Loaded template: ' + name, 'success');
}

async function deleteTemplate() {
  const name = dom.templateSelect.value;
  if (!name) {
    setStatus('Please select a template to delete.', 'error');
    return;
  }
  if (!confirm(`Delete template "${name}"?`)) return;

  const { templates = {} } = await getStorage(['templates']);
  delete templates[name];
  await setStorage({ templates });
  await loadTemplateDropdown();
  setStatus('🗑️ Deleted template: ' + name, 'success');
}

export function initTemplates() {
  dom.saveTemplateBtn.addEventListener('click', saveTemplate);
  dom.loadTemplateBtn.addEventListener('click', loadTemplate);
  dom.deleteTemplateBtn.addEventListener('click', deleteTemplate);
  loadTemplateDropdown();
}
