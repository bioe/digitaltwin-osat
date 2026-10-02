import { expect, test } from '@playwright/test'
import { store } from './helpers'

let errors: string[] = []
test.beforeEach(({ page }) => {
  errors = []
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(e.message))
})
test.afterEach(() => expect(errors).toEqual([]))

test('drill to fab L2, select a tool, run the tool-down scenario', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('detail-panel')).toContainText('Executive summary')

  await store(page, s => s.openBlock('fab'))
  await expect(page.getByTestId('breadcrumb')).toContainText('Fab')
  await page.getByRole('button', { name: /L2 · Cleanroom/ }).click()
  await expect(page.getByTestId('breadcrumb')).toContainText('L2')
  await store(page, s => s.openBlock('fab'))
  await store(page, s => s.openFloor('fab', 2))
  await expect(page.getByTestId('detail-panel')).toContainText('Tools running')

  await store(page, s => s.select({ kind: 'tool', id: 'ETCH-03' }))
  const panel = page.getByTestId('detail-panel')
  await expect(panel).toContainText('ETCH-03')

  await page.getByRole('button', { name: 'Scenarios' }).click()
  await page.getByRole('button', { name: /Tool down/ }).click()
  await expect(panel).toContainText('Down', { timeout: 5_000 })
  await expect(panel).toContainText('RF generator fault')
})

test('every selection kind opens its panel', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByTestId('detail-panel')
  const cases: [string, string][] = [
    ["s.select({ kind: 'foup', index: 4 })", 'Route progress'],
    ["s.select({ kind: 'rack', id: 'R2-03C' })", 'Rack R2-03C'],
    ["s.select({ kind: 'agv', id: 'AGV-02' })", 'Battery'],
    ["s.select({ kind: 'zone', id: 'O-L2-C' })", 'Meeting rooms'],
    ["s.select({ kind: 'kpiBoard' })", 'Site KPI board'],
  ]
  for (const [action, text] of cases) {
    await page.evaluate(a => new Function('s', a)((window as any).__store.getState()), action)
    await expect(panel).toContainText(text)
  }
})
