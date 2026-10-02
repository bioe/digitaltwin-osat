import type { Page } from '@playwright/test'
import type { FactoryStore } from '../src/store/store'

type StoreApi = { getState(): FactoryStore }

/** Run an action against the dev-only `window.__store` test hook. */
export function store<T>(page: Page, fn: (s: FactoryStore) => T): Promise<T> {
  return page.evaluate(
    src => {
      const s = (window as unknown as { __store: StoreApi }).__store.getState()
      return new Function('s', `return (${src})(s)`)(s)
    },
    fn.toString(),
  ) as Promise<T>
}
