import { existsSync } from 'fs'

// 서버(Vercel/로컬)에서 HTML을 A4 PDF로 렌더링한다.
// 로컬 Chrome/Edge → @sparticuz/chromium 순으로 시도 (moinBizplus.ts와 같은 전략).

const resolveLocalChromiumExecutable = () => {
  const env = process.env
  const candidates = [
    env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    env.CHROMIUM_EXECUTABLE_PATH,
    env.CHROME_EXECUTABLE_PATH,
    env.MSEDGE_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    env.ProgramFiles ? `${env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe` : '',
    env['ProgramFiles(x86)'] ? `${env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe` : '',
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
    env.ProgramFiles ? `${env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe` : '',
    env['ProgramFiles(x86)'] ? `${env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe` : '',
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe` : '',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      // try next
    }
  }
  return ''
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function launchBrowser() {
  const runtimeErrors: string[] = []
  const { chromium: playwrightChromium } = await import('playwright-core')

  const localExecutable = resolveLocalChromiumExecutable()
  if (localExecutable) {
    try {
      return await playwrightChromium.launch({
        headless: true,
        executablePath: localExecutable,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    } catch (error) {
      runtimeErrors.push(`local-chromium: ${getErrorMessage(error)}`)
    }
  }

  try {
    const chromium = (await import('@sparticuz/chromium')).default
    const executablePath = await chromium.executablePath()
    return await playwrightChromium.launch({
      headless: true,
      executablePath,
      args: chromium.args?.length ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  } catch (error) {
    runtimeErrors.push(`sparticuz-chromium: ${getErrorMessage(error)}`)
  }

  throw new Error(`PDF 렌더링용 브라우저를 실행할 수 없습니다: ${runtimeErrors.join(' | ')}`)
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    // 웹폰트(한글)까지 받아야 하므로 networkidle까지 대기
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30_000 })
    // 문자열 표현식으로 전달: 번들러 헬퍼(_optionalChain 등)가 브라우저 컨텍스트에 주입되는 문제 방지
    await page.evaluate('document.fonts ? document.fonts.ready : undefined')
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close().catch(() => undefined)
  }
}
