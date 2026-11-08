import { registry, type Registry } from '../engine/registry.ts';
import { missingForPublish, validateContentForTemplate } from '../engine/resolve.ts';
import type { TemplateLookup } from './services.ts';

/** Backs the service layer with a template registry (the engine's by default). */
export function createTemplateLookup(reg: Registry): TemplateLookup {
  return (id, version) => {
    const t = version === undefined ? reg.getActiveTemplate(id) : reg.getTemplateForRender(id, version);
    if (!t) return null;
    return {
      id: t.id, tier: t.tier, version: t.version,
      validateContent: (content) => validateContentForTemplate(t, content),
      missingForPublish: (content) => missingForPublish(t, content).map((m) => m.key),
    };
  };
}

export const lookupTemplate: TemplateLookup = createTemplateLookup(registry);
