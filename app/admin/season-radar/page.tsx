import SeasonRadarClient from './SeasonRadarClient'

export const metadata = {
  title: '어종별 시즌레이더 | BEIKO',
  description: '선상24 조황 게시글 기반 어종별 월간 시즌 및 지역 분석',
}

export default function SeasonRadarPage() {
  return <SeasonRadarClient />
}
