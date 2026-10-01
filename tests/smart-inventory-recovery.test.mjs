import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const rawUrl = 'https://gist.githubusercontent.com/beiko3444/5a69e99d96fa2ae34ba4af96c117d5e0/raw/monitor.json'
const monitorUrl = 'https://monitor.example.com'
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

function loadClient(fetch, env = {}) {
  const context = vm.createContext({
    fetch, process: { env }, console, URL, AbortController, DOMException,
    setTimeout, clearTimeout,
  })
  const load = (path) => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })
    const module = { exports: {} }
    const localRequire = (id) => id === '@/lib/smartInventoryHealth'
      ? load('../lib/smartInventoryHealth.ts') : require(id)
    vm.runInContext(`(function(require, module, exports) { ${outputText}\n })`, context)(localRequire, module, module.exports)
    return module.exports
  }
  return load('../lib/smartInventoryClient.ts')
}

{
  const requests = []
  const client = loadClient(async (url) => {
    requests.push(new URL(url))
    return json({ url: monitorUrl })
  }, { SMARTINVENTORY_MONITOR_URL_GIST: rawUrl })
  assert.equal((await client.resolveMonitorBase()).url, monitorUrl)
  assert.equal(requests[0].pathname.endsWith('/raw/monitor.json'), true)
}

{
  const client = loadClient(async (url) => new URL(url).hostname === 'api.github.com'
    ? json({ files: { 'monitor.json': { content: JSON.stringify({ url: monitorUrl }) } } })
    : json({}, 503))
  assert.equal((await client.resolveMonitorBase()).url, monitorUrl, 'GitHub API recovers a raw CDN outage')
}

{
  const client = loadClient(async () => { throw new TypeError('fetch failed') }, {
    SMARTINVENTORY_MONITOR_URL: monitorUrl,
  })
  assert.equal((await client.resolveMonitorBase()).url, monitorUrl, 'direct URL survives discovery failure')
}

{
  const client = loadClient(async () => json({ url: 'javascript:alert(1)' }))
  assert.equal(await client.resolveMonitorBase(), null, 'reject non-HTTP monitor URLs')
}

function liveResponse(url) {
  const parsed = new URL(url)
  if (parsed.hostname !== 'monitor.example.com') return json({ url: monitorUrl })
  switch (parsed.pathname) {
    case '/inventory': return json({ naver: [{ product_id: '1', name: 'Product', stock: 10 }], coupang: [] })
    case '/masters': return json({ masters: [{ id: 1, name: 'Product', unit_cost: 100 }] })
    case '/master-links': return json({ links: [{ channel: 'naver', product_key: '1|', master_id: 1 }] })
    case '/stock-inbounds': return json({ items: [], summaries: [] })
    case '/health': return json({ status: 'ok' })
    default: throw new Error(`Unexpected URL: ${url}`)
  }
}

{
  let available = true
  const client = loadClient(async (url) => {
    if (!available) throw new TypeError('fetch failed')
    return liveResponse(url)
  })
  const healthy = await client.fetchSmartInventoryDashboard({ refresh: true })
  assert.equal(healthy.summary.totalStock, 10)
  available = false
  const retained = await client.fetchSmartInventoryDashboard({ refresh: true })
  assert.equal(retained.rows.length, 1, 'failed discovery keeps the last healthy inventory')
  assert.equal(retained.summary.totalStock, 10)
  assert.equal(retained.cache.hit, true)
  available = true
  const recovered = await client.fetchSmartInventoryDashboard({ refresh: true })
  assert.equal(recovered.cache.hit, false)
}

{
  let available = false
  const client = loadClient(async (url) => {
    if (!available) throw new TypeError('fetch failed')
    return liveResponse(url)
  })
  assert.equal((await client.fetchSmartInventoryDashboard()).configured, false)
  available = true
  const recovered = await client.fetchSmartInventoryDashboard()
  assert.equal(recovered.summary.totalStock, 10, 'failure is not cached after a cold start')
  assert.equal(recovered.cache.hit, false)
}

console.log('smart inventory recovery tests passed')
