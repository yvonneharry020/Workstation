/**
 * Workstation Admin Panel — CI E2E Test
 * Credentials are injected via environment variables (GitHub Secrets).
 * Tests: login isolation, message instant visibility, clock widget per room.
 */

import { chromium } from 'playwright'

const BASE_URL = 'https://skiniq.store'

const ACCOUNTS = [
  {
    label:    'Admin Panel Room',
    email:    process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    commsUrl: `${BASE_URL}/staff-comms`,
    hasClock: false,
    msg1:     'CI check: Admin online. @Everyone build passed.',
    msg2:     'Automated test message from CI pipeline.',
  },
  {
    label:    'Management Room',
    email:    process.env.MANAGEMENT_EMAIL,
    password: process.env.MANAGEMENT_PASSWORD,
    commsUrl: `${BASE_URL}/ops/staff-comms`,
    hasClock: true,
    clockUrl: `${BASE_URL}/ops/dashboard`,
    msg1:     'CI check: Management online. @Technical confirm status.',
    msg2:     'Shift confirmation via CI test.',
  },
  {
    label:    'Technical Room',
    email:    process.env.TECHNICAL_EMAIL,
    password: process.env.TECHNICAL_PASSWORD,
    commsUrl: `${BASE_URL}/tech/staff-comms`,
    hasClock: true,
    clockUrl: `${BASE_URL}/tech/dashboard`,
    msg1:     'CI check: Tech team online. @Finance syncing.',
    msg2:     'System nominal — CI verified.',
  },
  {
    label:    'Finance Room',
    email:    process.env.FINANCE_EMAIL,
    password: process.env.FINANCE_PASSWORD,
    commsUrl: `${BASE_URL}/finance/staff-comms`,
    hasClock: true,
    clockUrl: `${BASE_URL}/finance/dashboard`,
    msg1:     'CI check: Finance online. @Management payroll clear.',
    msg2:     'Budget reconciliation — CI verified.',
  },
]

async function testAccount(browser, account, index) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page    = await context.newPage()

  const log    = (...args) => console.log(`[${account.label}]`, ...args)
  const issues = []

  try {
    if (!account.email || !account.password) {
      issues.push('SKIPPED: Missing credentials — set env vars in GitHub Secrets')
      return { account: account.label, issues, status: 'SKIP' }
    }

    // ── Login ──────────────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })

    const emailInput    = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (!(await emailInput.isVisible())) {
      issues.push('LOGIN FAILED: Email input not found')
      return { account: account.label, issues, status: 'FAIL' }
    }

    await emailInput.fill(account.email)
    await passwordInput.fill(account.password)
    await page.locator('button[type="submit"]').first().click()

    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 })
      .catch(() => issues.push('LOGIN FAILED: Still on login page after submit'))

    if (page.url().includes('access-restricted') || page.url().includes('unauthorized')) {
      issues.push(`ACCESS DENIED: Redirected to ${page.url()}`)
    }

    const cookieName = await page.evaluate(() => {
      const c = document.cookie.split(';').find(c => c.trim().startsWith('_wk_name='))
      return c ? decodeURIComponent(c.split('=')[1]) : null
    })
    log(`Logged in as: ${cookieName}`)

    // ── General page (staff-comms) ─────────────────────────────────────────
    await page.goto(account.commsUrl, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(2000)

    if (page.url().includes('unauthorized') || page.url().includes('access-restricted')) {
      issues.push(`COMMS ACCESS DENIED: ${page.url()}`)
    }

    const textarea = page.locator('textarea').first()
    if (!(await textarea.isVisible({ timeout: 5000 }).catch(() => false))) {
      issues.push('MESSAGING: Textarea not found on staff-comms page')
    } else {
      const isOnPage = (text) => page.evaluate((t) => document.body.innerText.includes(t), text)

      for (const [i, msg] of [[1, account.msg1], [2, account.msg2]]) {
        await textarea.click()
        await textarea.fill(msg)
        await page.keyboard.press('Enter')

        await page.waitForFunction(
          () => { const ta = document.querySelector('textarea'); return ta && ta.value === '' },
          { timeout: 5000 }
        ).catch(() => {})

        await page.waitForTimeout(500)

        const plainPrefix = msg.split('@')[0].trim()
        const snippet     = (plainPrefix.length > 8 ? plainPrefix : msg).substring(0, 22)
        const visible     = await isOnPage(snippet)

        if (!visible) {
          issues.push(`MSG ${i} VISIBILITY BUG: Message not visible immediately after sending`)
          log(`BUG: Message ${i} not visible immediately`)
        } else {
          log(`Message ${i} visible immediately ✓`)
        }
      }
    }

    // ── Clock widget ───────────────────────────────────────────────────────
    // Detects the widget container via its status text, which always renders
    // regardless of clock session state (idle, active, on break, or completed).
    if (account.hasClock) {
      await page.goto(account.clockUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(2000)

      if (page.url().includes('unauthorized') || page.url().includes('access-restricted')) {
        issues.push(`CLOCK DASHBOARD ACCESS DENIED: ${page.url()}`)
      } else {
        const clockStatus = page.locator('span').filter({ hasText: /^(Online|On Break|Offline|Auto Logged Out)$/i }).first()
        const found       = await clockStatus.isVisible({ timeout: 5000 }).catch(() => false)
        if (!found) {
          issues.push('CLOCK WIDGET: Not found on dashboard')
        } else {
          const statusText = (await clockStatus.textContent() ?? '').trim()
          log(`Clock widget present (status: "${statusText}") ✓`)
        }
      }
    }

    return {
      account: account.label,
      email:   account.email,
      name:    cookieName,
      issues,
      status:  issues.length === 0 ? 'PASS' : 'FAIL',
    }

  } catch (err) {
    await page.screenshot({ path: `/tmp/ws-${index}-error.png` }).catch(() => {})
    issues.push(`ERROR: ${err.message}`)
    return { account: account.label, issues, status: 'FAIL' }
  } finally {
    await context.close()
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('WORKSTATION CI — 4-Account Simultaneous Test')
  console.log('='.repeat(60))

  const browser = await chromium.launch({ headless: true })

  try {
    const results = await Promise.all(
      ACCOUNTS.map((account, i) => testAccount(browser, account, i + 1))
    )

    console.log('\n' + '='.repeat(60))
    console.log('RESULTS')
    console.log('='.repeat(60))

    let failed = false

    for (const r of results) {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '–' : '✗'
      console.log(`\n[${r.status}] ${icon} ${r.account}${r.email ? ` (${r.email})` : ''}`)
      if (r.name) console.log(`  Identity: ${r.name}`)
      if (r.issues.length === 0) {
        console.log('  All checks passed')
      } else {
        for (const issue of r.issues) console.log(`  ✗ ${issue}`)
        if (r.status === 'FAIL') failed = true
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(failed ? '✗ FAILURES DETECTED' : '✓ ALL TESTS PASSED')
    console.log('='.repeat(60))

    process.exit(failed ? 1 : 0)

  } finally {
    await browser.close()
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
