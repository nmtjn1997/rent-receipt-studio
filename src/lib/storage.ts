import { defaultConfig, normalizeConfig } from './defaults';
import type { Config } from './types';

const KEY = 'rent-receipt.v1';

export interface Store {
  activeId: string;
  configs: Config[];
}

const seedFiles = import.meta.glob('../seed.local.json', { eager: true, import: 'default' }) as Record<string, unknown>;

function seedConfigs(): Config[] {
  const raw = Object.values(seedFiles)[0];
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => normalizeConfig({ ...(c as Partial<Config>), id: (c as Partial<Config>).id ?? crypto.randomUUID() }));
}

export function loadStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null;
    if (parsed && Array.isArray(parsed.configs) && parsed.configs.length) {
      const configs = parsed.configs.map(normalizeConfig);
      const activeId = configs.some((c) => c.id === parsed.activeId) ? parsed.activeId : configs[0].id;
      return { activeId, configs };
    }
  } catch {
    /* fall through to first-run state */
  }
  const configs = seedConfigs();
  if (!configs.length) configs.push(defaultConfig());
  return { activeId: configs[0].id, configs };
}

export function saveStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode or quota: the app still works, it just will not remember */
  }
}
