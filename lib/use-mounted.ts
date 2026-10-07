"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true только в браузере после гидратации (на сервере и при гидратации — false). */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
