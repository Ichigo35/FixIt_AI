import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiPostJson } from '@/api/client';
import { ApiError } from '@/api/ApiError';
import { useConnectivity } from '@/lib/connectivity';
import {
  addItem,
  makeItem,
  markAttempt,
  pruneExhausted,
  removeItem,
  type OutboxItem,
} from './outboxQueue';

const KEY = 'fixit.outbox.v1';

interface OutboxState {
  pending: OutboxItem[];
  flushing: boolean;
  /** Met une mutation en file (appelé quand un POST échoue pour cause réseau). */
  enqueue: (input: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>) => void;
  /** Force une tentative de vidage (sinon déclenché à la reconnexion). */
  flush: () => Promise<void>;
}

const OutboxContext = createContext<OutboxState | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [flushing, setFlushing] = useState(false);
  const pendingRef = useRef<OutboxItem[]>([]);
  const { offline } = useConnectivity();
  const wasOffline = useRef(offline);

  const persist = useCallback(async (next: OutboxItem[]) => {
    pendingRef.current = next;
    setPending(next);
    try {
      if (next.length === 0) await SecureStore.deleteItemAsync(KEY);
      else await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    } catch {
      /* quota SecureStore dépassé : on garde au moins l'état mémoire */
    }
  }, []);

  // Restauration au démarrage.
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as OutboxItem[];
          if (Array.isArray(parsed)) {
            pendingRef.current = parsed;
            setPending(parsed);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    let queue = pendingRef.current;
    if (queue.length === 0) return;
    setFlushing(true);
    try {
      for (const item of [...queue]) {
        try {
          await apiPostJson(item.path, item.body);
          queue = removeItem(queue, item.id);
        } catch (err) {
          if (err instanceof ApiError) {
            // Erreur métier (404, 400…) : inutile de rejouer, on abandonne l'entrée.
            queue = removeItem(queue, item.id);
          } else {
            queue = markAttempt(queue, item.id);
          }
        }
        await persist(queue);
      }
      const { kept } = pruneExhausted(queue);
      if (kept.length !== queue.length) await persist(kept);
    } finally {
      setFlushing(false);
    }
  }, [flushing, persist]);

  // Rejoue la file quand on repasse en ligne.
  useEffect(() => {
    if (wasOffline.current && !offline) void flush();
    wasOffline.current = offline;
  }, [offline, flush]);

  const enqueue = useCallback(
    (input: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>) => {
      void persist(addItem(pendingRef.current, makeItem(input)));
    },
    [persist],
  );

  const value = useMemo<OutboxState>(
    () => ({ pending, flushing, enqueue, flush }),
    [pending, flushing, enqueue, flush],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxState {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error('useOutbox must be used within <OutboxProvider>');
  return ctx;
}
