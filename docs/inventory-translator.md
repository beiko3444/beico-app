# 재고 사이트 번역기

`/inventory`와 `/admin/inventory`의 **번역기** 버튼은 새 탭에서 `/translator`를 엽니다.
이 경로는 기존 사이트의 관리자 로그인을 확인한 뒤, 2분 동안 유효한 서명 링크로 파이 번역기에 연결합니다.
로그인하지 않았거나 관리자 권한이 없으면 로그인 화면으로 이동합니다.

번역 서버 코드는 `beiko3444/st`의 `translator/`에 있습니다.
파이에는 `kr-translator`, `kr-translator-tunnel`, `publish-translator-url.timer`가 설치됩니다.
번역기 세션은 30일 유지되며, 터널 주소가 바뀌면 재고 사이트 버튼으로 다시 접속하면 됩니다.

Vercel Production에 `TRANSLATOR_SHARED_SECRET`을 설정해야 합니다.
값은 파이의 `/etc/kr-translator.env`와 같아야 하며, 저장소나 로그에 노출하지 않습니다.
`TRANSLATOR_URL`은 고정 HTTPS 주소를 사용할 때만 설정합니다.
기본 설정은 기존 `SMARTINVENTORY_MONITOR_URL_GIST`와 같은 gist의 `translator.json`에서 주소를 찾습니다.
`TRANSLATOR_URL_GIST`로 파일 주소를 별도로 지정할 수도 있습니다.

파이의 `TRANSLATOR_PORTAL_URL`은 `https://www.beiko.co.kr/translator`입니다.
이 사이트에는 Python 재고 앱용 `SMARTINVENTORY_WEB_PASSWORD`가 필요하지 않습니다.

확인: 로그인한 관리자가 버튼을 누르면 번역기가 열리고, 로그인하지 않은 요청은 링크를 받지 못해야 합니다.
파이의 번역 서버가 정상이더라도 ChatGPT 로그인은 만료될 수 있으므로 실제 영어·중국어 번역도 확인합니다.
