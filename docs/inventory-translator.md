# Beiko 번역기

Beiko 관리자 메뉴와 파트너 메뉴에 언어 아이콘과 **번역기** 링크가 있습니다.
로그인 화면에서도 번역기를 열 수 있으며, 공유 주소는 `https://www.beiko.co.kr/translator`입니다.
사이트 로그인 없이 접속할 수 있습니다. `/translator`가 현재 파이 주소를 찾아 방문자 세션을 발급합니다.
개별 재고 화면의 번역기 버튼은 제거했습니다.

영어·중국어 번역문 아래에는 완성된 외국어 문장을 다시 한국어로 번역한 **한국어 확인 번역**이 표시됩니다.
한국어 원문을 복사하는 방식이 아니며, 각 언어의 결과를 별도 요청으로 확인합니다.
외국어 결과는 먼저 표시하고, 한국어 확인 번역이 실패해도 외국어 결과는 유지합니다.

파이 서버는 `beiko3444/st`의 `translator/`이며, `kr-translator`, `kr-translator-tunnel`, `publish-translator-url.timer`로 자동 실행됩니다.
Vercel Production의 `TRANSLATOR_SHARED_SECRET`은 `/etc/kr-translator.env`와 같아야 합니다.
`TRANSLATOR_URL_GIST`는 터널 주소를 게시하는 gist의 `translator.json` 파일 주소입니다.
고정 주소를 쓰면 `TRANSLATOR_URL`을 설정할 수 있습니다.
파이의 `TRANSLATOR_PORTAL_URL`은 `https://www.beiko.co.kr/translator`입니다.

방문자에게는 서버 계정 정보·사용량을 노출하지 않으며, 배포된 서버의 웹 로그인·로그아웃 API는 차단합니다.
파이의 ChatGPT 계정 관리는 SSH에서 Codex CLI로만 수행합니다.

확인: 로그인 없는 새 브라우저로 공유 링크 접속 → 입력 → 영어·중국어 결과 → 각 결과 아래 한국어 확인 번역.
