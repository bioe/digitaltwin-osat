import { test } from '@playwright/test'
import { store } from './helpers'

const OUT = process.env.SHOT_DIR ?? 'test-results/screens'

test('capture screenshots of each level', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture')
  const errors: string[] = []
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  const shot = async (name: string) => {
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/${name}.png` })
  }
  await shot('1-site')
  await store(page, s => s.openBlock('fab'))
  await shot('2-fab-block')
  await store(page, s => s.openFloor('fab', 2))
  await shot('3-fab-l2')
  await store(page, s => s.startScenario('particleSpike'))
  await store(page, s => s.setOverlay('particles'))
  await page.waitForTimeout(8000)
  await shot('4-fab-particles')
  await store(page, s => s.select({ kind: 'tool', id: 'ETCH-03' }))
  await shot('5-tool')
  await store(page, s => s.openFloor('warehouse', 1))
  await shot('6-warehouse-l1')
  await store(page, s => s.openFloor('office', 3))
  await shot('7-office-l3')
  await store(page, s => s.select({ kind: 'kpiBoard' }))
  await shot('8-kpi-board')
  await store(page, s => s.openFloor('fab', 1))
  await shot('9-fab-l1')
  console.log('PAGE ERRORS:', JSON.stringify(errors))
})
