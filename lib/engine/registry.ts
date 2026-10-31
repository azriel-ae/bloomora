import type { CategoryId, Locale, TemplateConfig } from './types.ts';
import { chapterOfUs } from './templates/chapter-of-us.ts';
import { pressedGarden } from './templates/pressed-garden.ts';
import { ourLittleArchive } from './templates/our-little-archive.ts';
import { justALetter } from './templates/just-a-letter.ts';

/**
 * Every template version ever shipped stays in this list. Published gifts pin
 * `templateVersion`, so retiring or revising a template never changes how an
 * existing gift renders. To change a template's fields or layout, add a new
 * entry with version + 1 and leave the old one in place.
 */
export const ALL_TEMPLATE_VERSIONS: readonly TemplateConfig[] = [chapterOfUs, pressedGarden, ourLittleArchive, justALetter];

export type Registry = ReturnType<typeof createRegistry>;

/** Factory so tests can build registries with retired or older template versions. */
export function createRegistry(versions: readonly TemplateConfig[]) {
  const latestOf = (id: string): TemplateConfig | undefined =>
    versions.filter((t) => t.id === id).sort((a, b) => b.version - a.version)[0];

  /** For creating/editing and the catalog: the newest version, and only while it is active. */
  function getActiveTemplate(id: string): TemplateConfig | null {
    const t = latestOf(id);
    return t && t.status === 'active' ? t : null;
  }

  /**
   * For rendering or editing an existing gift (Model B): the exact pinned version, regardless of
   * whether the template has since been deactivated. Falls back to the newest version only
   * if the pinned one is somehow absent.
   */
  function getTemplateForRender(id: string, version: number): TemplateConfig | null {
    return versions.find((t) => t.id === id && t.version === version) ?? latestOf(id) ?? null;
  }

  function listCatalog(): TemplateConfig[] {
    const ids = [...new Set(versions.map((t) => t.id))];
    return ids.map(latestOf).filter((t): t is TemplateConfig => !!t && t.status === 'active');
  }

  function searchCatalog(query: string, locale: Locale, category?: CategoryId | null): TemplateConfig[] {
    const q = query.trim().toLowerCase();
    return listCatalog().filter((t) => {
      if (category && t.category !== category) return false;
      if (!q) return true;
      return [t.name, t.tagline, t.description].some((l) => l[locale].toLowerCase().includes(q) || l.en.toLowerCase().includes(q));
    });
  }

  /** The single featured template that has a real demo, or null. */
  function getFeaturedDemo(): TemplateConfig | null {
    return listCatalog().find((t) => t.featured && t.hasDemo) ?? null;
  }

  return { versions, getActiveTemplate, getTemplateForRender, listCatalog, searchCatalog, getFeaturedDemo };
}

export const registry = createRegistry(ALL_TEMPLATE_VERSIONS);
export const { getActiveTemplate, getTemplateForRender, listCatalog, searchCatalog, getFeaturedDemo } = registry;
