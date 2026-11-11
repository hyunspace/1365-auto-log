# 쉼터 봉사 1365 활동일지 자동화

봉사자가 쉼터 현장에서 폼을 제출하면, 매주 화요일 오전에 지난주(월~일) **자원봉사자 활동 일지 PDF**가 자동으로 만들어집니다. 운영진이 텔레그램에서 확인하고 버튼을 누르면 자원봉사센터로 메일이 발송됩니다.

다른 쉼터·기관에서도 가져다 쓸 수 있도록 공개합니다. **쉼터별 값(좌표, 메일 주소, 직인 이미지, 토큰 등)은 이 레포에 하나도 들어 있지 않습니다.** 모두 Apps Script의 Script Properties와 구글 드라이브에 둡니다.

## 주요 기능

- **현장 제출 폼**: QR로 접속해 1분 안에 제출. 브라우저 위치 정보로 쉼터 반경 안에서만 제출 가능 (서버에서 하버사인 거리로 재검증)
- **주간 자동 집계**: 매주 화요일 지난주 신청 건을 모아 텔레그램으로 마감 알림
- **PDF 생성**: 구글 시트 양식 템플릿에 값을 채워 PDF로 내보내기 (한 장에 11명, 초과 시 여러 장)
- **텔레그램 승인**: 작성·발송은 되돌릴 수 없으므로 버튼으로만 승인
- **자연어 수정**: "3번 연락처 010-1111-2222로 바꿔줘" 같은 문장을 LLM이 명령으로 변환, 확인 버튼 후에만 반영
- **개인정보 자동 파기**: 발송 후 3개월(설정 가능)이 지나면 신청 행, PDF, 서명 이미지 삭제
- **운영 비용 0원**: 구글 무료 서비스 + 정적 호스팅 + 무료 LLM 티어

## 구조

```
봉사자 폼(정적 HTML) ──POST──▶ Apps Script 웹앱 ◀──웹훅── 텔레그램 봇(운영진 그룹)
                                   │
                    구글 시트 · 드라이브 · Gmail (쉼터 공용 계정)
```

서버 없이 Apps Script 웹앱 하나가 백엔드입니다. 폼만 정적 페이지로 따로 두는 이유는 Apps Script HTML이 iframe 안에서 돌아 위치 권한이 막힐 수 있기 때문입니다.

자세한 요구사항은 [`docs/PRD.md`](docs/PRD.md)를 참고하세요.

```
web/    정적 폼 (Vercel 또는 GitHub Pages)
gas/    Apps Script 코드 (clasp로 동기화)
docs/   PRD
```

## 설치 가이드

코드는 `clasp`로 올리지만, 계정 권한이 필요한 단계는 직접 해야 합니다. **모든 과정은 쉼터 공용 Gmail 계정으로 로그인해서** 진행하세요.

### 1. Apps Script 준비 (처음 한 번)

1. 구글 시트를 새로 만들고, 확장 프로그램 → Apps Script로 프로젝트를 생성합니다.
2. [script.google.com/home/usersettings](https://script.google.com/home/usersettings)에서 **Google Apps Script API**를 켭니다. clasp 사용에 필요합니다.
3. 터미널에서 `clasp login`을 실행합니다. 이것도 공용 계정으로 로그인해야 합니다.
   ```bash
   npm i -g @google/clasp
   clasp login
   ```
4. 프로젝트 설정에서 시간대를 `Asia/Seoul`로 맞춥니다.

### 2. 드라이브 준비

- PDF를 저장할 폴더를 만들고, 직인 이미지를 업로드한 뒤 각각의 ID를 복사해 둡니다.
- **활동일지 양식 템플릿 시트**가 필요합니다. 양식은 기관마다 다를 수 있어 레포에 포함하지 않습니다. 템플릿을 만들어 주는 함수(`createTemplateSheet()`)를 한 번 실행해 기본 양식을 만들고, 센터 양식에 맞게 수정하세요.
- 시트와 폴더는 공용 계정 소유로 두고 **운영진 계정에만 공유**합니다. 링크 공유는 하지 마세요.

### 3. Script Properties 입력

프로젝트 설정 → 스크립트 속성에 아래 값을 입력합니다. 코드 수정·재배포 없이 여기서 바꿀 수 있습니다.

| 키 | 예시 | 용도 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC…` | 봇 토큰 (비밀) |
| `TELEGRAM_CHAT_ID` | `-100123…` | 운영진 그룹 ID |
| `ADMIN_USER_IDS` | `11111,22222` | 버튼·명령을 허용할 사용자 ID |
| `WEBHOOK_SECRET` | 임의의 긴 문자열 | 웹훅 검증용 (비밀) |
| `WEBAPP_URL` | `https://script.google.com/macros/s/…/exec` | `setWebhook()`이 등록할 웹앱 주소 |
| `LLM_API_KEY` | | 자연어 수정용 API 키 (비밀) |
| `LLM_MODEL` | | 사용할 모델명 |
| `SHELTER_LAT` / `SHELTER_LNG` | `37.5…` / `126.7…` | 쉼터 좌표 |
| `GEOFENCE_RADIUS_M` | `300` | 허용 반경(m) |
| `TIME_MODE` | `free` | 활동시간 선택 방식: `free`(시작·종료 시각 자유 선택) / `preset`(오전·오후·종일 중 하나) |
| `ACTIVITY_WINDOW` | `10:00~18:00` | `free`: 시작·종료 시각을 고를 수 있는 범위 (10분 단위) |
| `MAX_ACTIVITY_HOURS` | `8` | `free`: 한 번에 신청할 수 있는 최대 활동시간 |
| `TIME_MORNING` / `TIME_AFTERNOON` / `TIME_FULLDAY` | `10:00~14:00` / `14:00~18:00` / `10:00~18:00` | `preset`: 오전·오후·종일 시간 |
| `ORG_NAME` | `○○쉼터` | 활동기관·기관명 |
| `ACTIVITY_DESC` | | 활동내용(공통) |
| `MANAGER_NAME` / `MANAGER_PHONE` | | 담당자·연락처 |
| `SHEET_ID` | | 데이터 시트 ID |
| `TEMPLATE_SHEET_ID` | | 활동일지 양식 템플릿 시트 ID |
| `DRIVE_FOLDER_ID` | | PDF 저장 폴더 ID |
| `SEAL_IMAGE_FILE_ID` | | 직인 이미지 파일 ID |
| `SIGNATURE_FOLDER_ID` | | 봉사자 전자서명 이미지 저장 폴더 ID (운영진만 공유) |
| `MAIL_TO` | | 수신자 (자원봉사센터 담당자) |
| `MAIL_CC` | `a@…,b@…` | 참조 |
| `MAIL_SUBJECT` | `[{org}] 자원봉사 활동일지 제출 ({start}~{end})` | 제목 템플릿 |
| `MAIL_BODY` | | 본문 템플릿 |
| `PDF_FILENAME` | `{end}_{org}_활동일지.pdf` | 첨부파일명 템플릿 |
| `RETENTION_MONTHS` | `3` | 개인정보 보관 개월 수 |

메일 템플릿에서 쓸 수 있는 치환 변수: `{org}`, `{start}`, `{end}`, `{count}`, `{sent_date}`

> 테스트 중에는 `MAIL_TO`를 본인 메일로 바꿔 실제 센터로 나가지 않게 하세요.

### 4. 웹앱 배포

1. 배포 → 새 배포 → 유형: **웹 앱**
2. 실행 사용자: **나(공용 계정)**, 액세스 권한: **모든 사용자**
3. 나온 웹앱 URL을 폼 설정(`web/config.js`)에 넣습니다.

> **주의**: 코드를 고친 뒤 "새 배포"를 만들면 URL이 바뀝니다. **배포 관리 → 수정 → 새 버전**으로 올려야 URL이 유지됩니다. 터미널에서는 `clasp deploy -i <배포ID>`를 쓰면 됩니다.

### 5. 권한 승인과 초기화

- 처음 함수를 실행하면 Gmail, 드라이브, 외부 요청 권한을 요청합니다. "확인되지 않은 앱" 경고가 뜨면 **고급 → 이동**으로 승인하세요.
- 아래 초기화 함수를 편집기에서 한 번씩 수동 실행합니다.
  - `setupSheets()`: 시트 탭·컬럼 생성
  - `setupTriggers()`: 시간 기반 트리거 등록
  - `setWebhook()`: 텔레그램 웹훅 등록

### 6. 폼 호스팅

`web/` 폴더를 Vercel로 올립니다. Vercel 프로젝트의 Root Directory를 `web`으로 두고 환경변수 `WEBAPP_URL`에 웹앱 URL을 넣으면, 빌드 단계에서 `config.js`가 만들어집니다. 활동시간 선택 방식과 범위는 웹앱 `doGet`에서 내려받으므로 폼을 고치지 않아도 됩니다. 쉼터 현장에 붙일 QR코드는 배포된 폼 주소로 만드세요.

## 텔레그램 설정

1. BotFather에서 봇을 만들고 토큰을 받습니다.
2. **자연어 수정을 쓰려면 privacy mode를 꺼야 합니다.** BotFather에서 `/setprivacy` → `Disable`로 설정하세요. 기본 상태에서는 봇이 그룹의 일반 메시지를 읽지 못합니다. (버튼만 쓴다면 필요 없습니다.) 그룹에 초대하기 **전에** 바꾸세요. 초대 후에 바꾸면 봇을 내보냈다가 다시 초대해야 적용됩니다.
3. 운영진 그룹에 봇을 초대하고, 그룹에 메시지를 하나 보낸 뒤 `https://api.telegram.org/bot<토큰>/getUpdates`에서 그룹 chat ID(`chat.id`)와 본인 user ID(`from.id`)를 확인합니다. (웹훅 등록 전에만 동작)
4. 스크립트 속성에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_USER_IDS`, `WEBHOOK_SECRET`, `WEBAPP_URL`을 넣고 편집기에서 `setWebhook()`을 실행합니다. `checkWebhook()`으로 등록 상태를, `sendTestMessage()`로 버튼 동작을 확인합니다.
5. 운영진을 추가할 때는 그 사람이 그룹에서 `/myid`를 보내면 봇이 user ID를 알려줍니다. `ADMIN_USER_IDS`에 쉼표로 이어 붙이세요.

## LLM 설정

자연어 수정에 쓸 모델(예: Gemini Flash 무료 티어, Claude Haiku)을 정하고 API 키를 발급받아 `LLM_API_KEY`, `LLM_MODEL`에 넣습니다. LLM에는 해당 주차 명단의 번호·이름·수정 대상 필드 등 최소한의 정보만 전송하며, 운영진 메시지 속 연락처·생년월일은 전송 전에 자리표시자로 치환합니다. 무료 티어는 입력이 서비스 개선에 쓰일 수 있으므로 이 마스킹을 끄지 마세요.

## 보안과 개인정보

- 토큰, API 키, 좌표, 메일 주소, 직인 이미지 등 쉼터별 값은 **절대 커밋하지 마세요.** Script Properties와 드라이브에만 둡니다.
- 텔레그램 웹훅은 URL 쿼리의 `WEBHOOK_SECRET`으로 검증합니다.
- 허용된 사용자 ID(`ADMIN_USER_IDS`)만 버튼·명령을 처리합니다.
- 로그에는 연락처·생년월일을 남기지 않습니다.
- 개인정보는 발송 후 `RETENTION_MONTHS`가 지나면 자동 파기됩니다. 이 도구를 쓰는 기관은 자체 개인정보 처리 방침과 법적 요건을 직접 확인해야 합니다.

## 라이선스

[MIT License](LICENSE)
