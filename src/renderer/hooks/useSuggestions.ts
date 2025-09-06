/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { suggestNext } from '../llm/generator';

type Lang = 'xquery' | 'javascript' | 'sparql' | 'optic';

export function useSuggestions(params: { language: Lang; debounceMs?: number }) {
  const { language, debounceMs = 200 } = params;
  const [text, setText] = useState<string>('');
  const [cursor, setCursor] = useState<number>(0);
  const [streamed, setStreamed] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<any>(null);

  const request = useCallback((buffer: string, pos: number) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setStreamed('');

    (async () => {
      for await (const chunk of suggestNext({ buffer, cursor: pos, language, signal: abortRef.current.signal })) {
        setStreamed((prev) => prev + chunk);
      }
    })().catch(() => {});
  }, [language]);

  const update = useCallback((buffer: string, pos: number) => {
    setText(buffer);
    setCursor(pos);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => request(buffer, pos), Math.max(150, debounceMs));
  }, [debounceMs, request]);

  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { streamed, update, cancel: () => abortRef.current?.abort() };
}


