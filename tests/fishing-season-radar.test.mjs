import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fishData = JSON.parse(readFileSync(new URL('../public/data/fishing-season/month-region.json', import.meta.url), 'utf8'))
const coordinates = JSON.parse(readFileSync(new URL('../public/data/fishing-season/region-coordinates.json', import.meta.url), 'utf8'))
const navSource = readFileSync(new URL('../app/admin/AdminNav.tsx', import.meta.url), 'utf8')
const radarSource = readFileSync(new URL('../app/admin/season-radar/SeasonRadarClient.tsx', import.meta.url), 'utf8')

assert.equal(Object.keys(fishData).length, 12, 'twelve product-planning fish species should be available')
assert.match(navSource, /\/admin\/season-radar/, 'admin navigation should expose the season radar')
assert.match(radarSource, /피크 시즌/, 'the radar should label the peak season')
assert.match(radarSource, /value: '시작'/, 'the chart should mark the season start')
assert.match(radarSource, /value: '끝'/, 'the chart should mark the season end')

for (const [fish, months] of Object.entries(fishData)) {
  assert.deepEqual(Object.keys(months), Array.from({ length: 12 }, (_, index) => String(index + 1)), `${fish} should include all twelve months`)
  for (const [month, record] of Object.entries(months)) {
    assert.ok(Number.isFinite(record.total) && record.total >= 0, `${fish} ${month}월 total should be valid`)
    assert.ok(record.regions.length <= 6, `${fish} ${month}월 should keep the ranking compact`)
    for (let index = 1; index < record.regions.length; index += 1) {
      assert.ok(record.regions[index - 1][1] >= record.regions[index][1], `${fish} ${month}월 ranking should be sorted`)
    }
    for (const [region] of record.regions) {
      if (!region.endsWith('기타')) {
        assert.ok(coordinates[region], `${region} should have map coordinates`)
      }
    }
  }
}

console.log('fishing season radar ok')
