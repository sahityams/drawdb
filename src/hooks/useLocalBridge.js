import { useEffect, useRef, useCallback } from "react";

export function useLocalBridge({ applyDiagram, enabled }) {
  const lastContent = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/diagram_state.json?t=" + Date.now());
      if (!res.ok) return;
      const text = await res.text();
      if (text === lastContent.current) return;
      lastContent.current = text;
      const data = JSON.parse(text);
      applyDiagram(data);
    } catch {
      // File doesn't exist yet or invalid JSON — skip silently
    }
  }, [applyDiagram]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(poll, 1500);
    poll();
    return () => clearInterval(interval);
  }, [enabled, poll]);
}
