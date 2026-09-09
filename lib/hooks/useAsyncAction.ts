'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wraps an async action with loading + a brief success flash — the same
 * "spinner while working, checkmark for a moment when it lands" feedback
 * everywhere in the app, instead of every screen inventing its own. The
 * wrapped action returns `false` to signal a handled failure (validation,
 * a non-ok response already shown via setError) — anything else counts as
 * success and triggers the checkmark.
 *
 * Takes a plain (non-memoized) function — it's re-read from a ref on every
 * call so callers don't need to wrap their handler in useCallback just to
 * use this.
 */
export function useAsyncAction(action: () => Promise<boolean | void>) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const actionRef = useRef(action);
  actionRef.current = action;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const result = await actionRef.current();
      if (result !== false) {
        setSuccess(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setSuccess(false), 1000);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading, success };
}
