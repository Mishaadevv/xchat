import { useEffect, useState } from "react";

export function useStore<T>(
  subscribe: (listener: () => void) => () => void,
  getState: () => T
): T {
  const [state, setState] = useState(getState());

  useEffect(() => {
    const unsubscribe = subscribe(() => setState(getState()));
    return unsubscribe;
  }, [subscribe, getState]);

  return state;
}
