'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { workspaceStore } from '@/lib/api/workspace-store';

/* ------------------------------------------------------------------ */
/* Config types                                                         */
/* ------------------------------------------------------------------ */

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
}

export interface CardConfig {
  key: string;
  label: string;
  visible: boolean;
}

export interface FilterConfig {
  key: string;
  label: string;
  visible: boolean;
}

export type SectionType = 'header' | 'filters' | 'table' | 'stats' | 'list' | 'custom';

export interface SectionConfig {
  visible: boolean;
  sectionType: SectionType;
  label?: string;
  title?: string;
  subtitle?: string;
  columns?: ColumnConfig[];
  cards?: CardConfig[];
  filters?: FilterConfig[];
}

export type SiteConfig = Record<string, SectionConfig>;

/* ------------------------------------------------------------------ */
/* Context                                                              */
/* ------------------------------------------------------------------ */

interface EditContextValue {
  editMode: boolean;
  toggleEditMode: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  siteConfig: SiteConfig;
  registerSection: (id: string, defaults: SectionConfig) => void;
  updateSection: (id: string, patch: Partial<SectionConfig>) => void;
  updateColumn: (sectionId: string, columnKey: string, patch: Partial<ColumnConfig>) => void;
  updateCard: (sectionId: string, cardKey: string, patch: Partial<CardConfig>) => void;
  updateFilter: (sectionId: string, filterKey: string, patch: Partial<FilterConfig>) => void;
  getSection: (id: string) => SectionConfig | null;
  /** Throws away every edit, so the screen goes back to how it ships. */
  resetConfig: () => void;
}

const EditContext = createContext<EditContextValue | null>(null);

/** Where the eACC app itself keeps its layout edits. */
export const SITE_CONFIG_KEY = 'eacc:site-config';

export function EditProvider({
  children,
  /**
   * Which layout the edits belong to. The app uses one config for the whole
   * product; a prototype html file previewed in WE-ADK passes its own key, so
   * each file keeps its own variant of the same screen.
   */
  storageKey = SITE_CONFIG_KEY,
  /**
   * Whether the screen opens in edit mode. WE-ADK's Design tab drives this, so
   * it follows the prop as well as seeding it — switching back to Preview has
   * to put the editor away.
   */
  initialEditMode = false,
  /** Called with the layout after every edit, for anything mirroring it. */
  onConfigChange,
}: {
  children: ReactNode;
  storageKey?: string;
  initialEditMode?: boolean;
  onConfigChange?: (config: SiteConfig) => void;
}) {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({});

  useEffect(() => {
    setEditMode(initialEditMode);
    if (!initialEditMode) setSelectedId(null);
  }, [initialEditMode]);

  useEffect(() => {
    // Sections register their defaults while mounting, which happens before
    // this runs — so merge the stored layout over them rather than replacing
    // the state, or the screen would come back with no sections at all.
    let stored: SiteConfig = {};
    try {
      const raw = workspaceStore.getItem(storageKey);
      if (raw) stored = JSON.parse(raw) as SiteConfig;
    } catch {
      stored = {};
    }
    setSiteConfig((current) => {
      const merged = { ...current, ...stored };
      // Write the merged layout back, so the Design tab always has something to
      // patch. Stored wins over the registered defaults, so this cannot undo an
      // edit made from the other side.
      try {
        workspaceStore.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  }, [storageKey]);

  const persist = useCallback(
    (config: SiteConfig, notify = true) => {
      try {
        workspaceStore.setItem(storageKey, JSON.stringify(config));
      } catch {
        // ignore
      }
      // Registering a section is the screen describing itself, not the user
      // changing anything — mirroring that would undo edits made elsewhere.
      if (notify) onConfigChange?.(config);
    },
    [storageKey, onConfigChange],
  );

  const toggleEditMode = useCallback(() => {
    setEditMode((v) => !v);
    setSelectedId(null);
  }, []);

  const registerSection = useCallback((id: string, defaults: SectionConfig) => {
    setSiteConfig((prev) => {
      if (prev[id]) return prev; // already registered
      // Registration only seeds what the screen ships with — writing it would
      // overwrite a layout edited from the Design tab before it is read back.
      return { ...prev, [id]: defaults };
    });
  }, []);

  const updateSection = useCallback(
    (id: string, patch: Partial<SectionConfig>) => {
      setSiteConfig((prev) => {
        const existing = prev[id] ?? ({} as SectionConfig);
        const merged: SectionConfig = { ...existing, ...patch } as SectionConfig;
        const next: SiteConfig = { ...prev, [id]: merged };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateColumn = useCallback(
    (sectionId: string, columnKey: string, patch: Partial<ColumnConfig>) => {
      setSiteConfig((prev) => {
        const section = prev[sectionId];
        if (!section?.columns) return prev;
        const cols = section.columns.map((col) =>
          col.key === columnKey ? { ...col, ...patch } : col,
        );
        const next = { ...prev, [sectionId]: { ...section, columns: cols } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateCard = useCallback(
    (sectionId: string, cardKey: string, patch: Partial<CardConfig>) => {
      setSiteConfig((prev) => {
        const section = prev[sectionId];
        if (!section?.cards) return prev;
        const cards = section.cards.map((c) => (c.key === cardKey ? { ...c, ...patch } : c));
        const next = { ...prev, [sectionId]: { ...section, cards } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateFilter = useCallback(
    (sectionId: string, filterKey: string, patch: Partial<FilterConfig>) => {
      setSiteConfig((prev) => {
        const section = prev[sectionId];
        if (!section?.filters) return prev;
        const filters = section.filters.map((f) => (f.key === filterKey ? { ...f, ...patch } : f));
        const next = { ...prev, [sectionId]: { ...section, filters } };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const getSection = useCallback(
    (id: string): SectionConfig | null => siteConfig[id] ?? null,
    [siteConfig],
  );

  const resetConfig = useCallback(() => {
    setSelectedId(null);
    setSiteConfig({});
    try {
      workspaceStore.removeItem(storageKey);
    } catch {
      // ignore
    }
    // Sections re-register their defaults on the next render.
  }, [storageKey]);

  const value = useMemo(
    () => ({
      editMode,
      toggleEditMode,
      selectedId,
      setSelectedId,
      siteConfig,
      registerSection,
      updateSection,
      updateColumn,
      updateCard,
      updateFilter,
      getSection,
      resetConfig,
    }),
    [
      editMode,
      toggleEditMode,
      selectedId,
      siteConfig,
      registerSection,
      updateSection,
      updateColumn,
      updateCard,
      updateFilter,
      getSection,
      resetConfig,
    ],
  );

  return <EditContext.Provider value={value}>{children}</EditContext.Provider>;
}

export function useEdit(): EditContextValue {
  const ctx = useContext(EditContext);
  if (!ctx) throw new Error('useEdit must be used inside EditProvider');
  return ctx;
}
