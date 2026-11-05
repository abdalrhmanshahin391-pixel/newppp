import { useCallback, useEffect, useState } from "react";

/** URL fragments select local panels, without routing or waiting for data. */
export function useLearnSection(ids: readonly string[]) {
  const [state, setState] = useState(() => ({
    active: ids[0] ?? "",
    visited: new Set([ids[0] ?? ""]),
  }));
  const active = ids.includes(state.active) ? state.active : (ids[0] ?? "");
  const select = useCallback((id: string) => {
    setState((current) =>
      current.active === id && current.visited.has(id)
        ? current
        : {
            active: id,
            visited: new Set([...current.visited, id]),
          },
    );
  }, []);

  useEffect(() => {
    const fromAddress = () => {
      const hash = window.location.hash.slice(1);
      select(ids.includes(hash) ? hash : (ids[0] ?? ""));
    };
    fromAddress();
    window.addEventListener("hashchange", fromAddress);
    window.addEventListener("popstate", fromAddress);
    return () => {
      window.removeEventListener("hashchange", fromAddress);
      window.removeEventListener("popstate", fromAddress);
    };
  }, [ids, select]);

  const choose = useCallback(
    (id: string) => {
      if (!ids.includes(id) || id === active) return;
      select(id);
      // Preserve the router's own history metadata and all pathname/query values.
      // These fragments have no matching anchor, so selecting a panel cannot jump the page.
      try {
        window.history.pushState(window.history.state, "", `#${id}`);
      } catch {
        // Browsers may restrict history in embeds; selection must still work.
      }
    },
    [active, ids, select],
  );

  return { active, visited: state.visited, choose };
}
