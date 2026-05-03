import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = fs.readFileSync(new URL('../lib/wormEmailBody.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const module = { exports: {} }
vm.runInNewContext(outputText, { module, exports: module.exports, require }, { filename: 'wormEmailBody.js' })

const { emailBodyToDisplayText } = module.exports

assert.equal(typeof emailBodyToDisplayText, 'function')

const html = '<div>Hello&nbsp;Michael<br><script>alert("x")</script><a onclick="bad()">Invoice &amp; AWB</a></div>'
const rendered = emailBodyToDisplayText(html)

assert.match(rendered, /Hello Michael/)
assert.match(rendered, /Invoice & AWB/)
assert.doesNotMatch(rendered, /script|alert|onclick|<div|<a/i)
assert.equal(emailBodyToDisplayText('Line 1\nLine 2'), 'Line 1\nLine 2')

console.log('worm-email-body-ok')
