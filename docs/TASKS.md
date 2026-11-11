# 작업 목록 (Tasks)

[PRD](PRD.md) 10장 구현 순서를 기준으로 정리했습니다. 위에서부터 순서대로 진행하고, 각 단계 끝의 **확인** 항목을 통과하면 다음 단계로 넘어갑니다.

- 🙋 = 직접 해야 하는 작업 (계정 권한, 앱 설정 등)
- 🤖 = Claude Code에게 시키는 작업 (코드 작성)
- 커밋 스코프는 [CLAUDE.md](../CLAUDE.md)를 따릅니다.
- 준비해야 할 설정값과 API 키 목록은 [.env.example](../.env.example)에 정리되어 있습니다. 실제 값은 Apps Script의 Script Properties에 입력합니다.

## 0. 사전 준비

- [ ] 🙋 쉼터 공용 Gmail 계정 준비 (이후 모든 작업은 이 계정으로)
- [x] 🙋 구글 시트 새로 만들고 Apps Script 프로젝트 생성
- [x] 🙋 [Apps Script API](https://script.google.com/home/usersettings) 켜기
- [x] 🙋 `npm i -g @google/clasp` → `clasp login` (공용 계정)
- [x] 🙋 프로젝트 설정에서 시간대 `Asia/Seoul` 확인
- [ ] 🙋 테스트용 텔레그램 그룹 + 테스트 수신용 메일 준비
- [ ] 🙋 쉼터 정확한 좌표와 허용 반경 정하기 (PRD 미정 사항)
- [x] 🙋 자연어 수정에 쓸 LLM 정하기: **Gemini Flash 무료 티어로 결정** (무료 티어는 입력이 서비스 개선에 쓰일 수 있어 마스킹 필수, 7단계 참고)
- [x] 🤖 `chore`: 레포 뼈대 (`web/`, `gas/`, `appsscript.json`, `.clasp.json.example`), `.gitignore`
- [x] 🙋 `.clasp.json.example`을 `.clasp.json`으로 복사하고 `scriptId` 입력
- [ ] 🙋 `web/config.example.js`를 `web/config.js`로 복사 (웹앱 URL은 4단계 배포 후 입력)

**확인**: `clasp push`가 성공하고 편집기에서 코드가 보인다.

> `.clasp.json`의 scriptId, `web/config.js`는 쉼터별 값이므로 `.gitignore`에 넣고, 예시 파일(`*.example`)만 커밋합니다.

## 1. 시트 구조와 설정 (`gas`, `sheet`)

- [x] 🤖 `Config.js`: Script Properties 읽기, 필수값 누락 시 오류 알림
- [x] 🤖 `Sheet.js` + `setupSheets()`: 신청 / 주차 / 대화상태 / 처리로그 탭과 컬럼 생성 (생년월일·연락처는 텍스트 서식)
- [x] 🙋 Script Properties 1차 입력: `SHEET_ID`, `SHELTER_LAT/LNG`, `GEOFENCE_RADIUS_M`, 활동시간 설정(`TIME_MODE` 등) (반경·활동시간은 비우면 기본값)
- [x] 🙋 `setupSheets()` 수동 실행, 권한 승인

**확인**: 시트에 탭 4개와 컬럼이 생기고, 값을 하나 지우면 오류가 뜬다.

## 2. 봉사자 폼과 제출 처리 (`form`, `gas`)

- [x] 🤖 `Main.js`: `doGet`(활동시간 선택 방식·범위 반환) / `doPost` 라우팅 (`update_id` 유무로 웹훅·폼 구분)
- [x] 🤖 `Form.js`: 하버사인 거리 검증, 중복 체크(봉사일자+이름+생년월일), 레이트 리밋, 행 추가
- [x] 🤖 `web/`: 입력 폼, 위치 권한 요청, 형식 검증, 활동시간 선택(`TIME_MODE`: `free` 시작·종료 10분 단위 최대 8시간 / `preset` 오전·오후·종일), 제출 전 확인 팝업, `text/plain` POST, 완료·실패 화면
- [x] 🙋 웹앱 배포: 편집기 **배포 → 새 배포 → 웹 앱** (실행: 나 / 액세스: 모든 사용자)
  - 웹 앱 URL(`.../exec`)과 배포 ID를 메모 (`.env`의 `WEBAPP_URL`, `DEPLOYMENT_ID`)
  - 브라우저로 URL을 열어 `{"ok":true,"mode":...}`가 보이는지 확인
- [x] 🙋 Vercel로 폼 호스팅: **Add New → Project**에서 이 레포 Import
  - Root Directory `web`, Framework Preset `Other`, 환경변수 `WEBAPP_URL` = 웹 앱 URL
  - 빌드 로그에 `config.js 생성 완료`가 보이면 정상 (URL이 없거나 형식이 틀리면 빌드 실패)
  - 웹 앱 URL이 바뀌면 Vercel 환경변수를 고치고 재배포
- [x] 🙋 코드 수정 후 URL 유지 확인: `npx @google/clasp -A .clasprc.json push --force` → `npx @google/clasp -A .clasprc.json deploy -i <배포ID>` (새 배포를 만들면 URL이 바뀜)

**확인 (폰으로 테스트)**: 제출 성공 / 반경 밖 거부 / 위치 거부 시 버튼 비활성 / 같은 사람 재제출 거부. (쉼터 현장 최종 확인은 9단계)

- [x] 쉼터 밖(현재 위치 좌표·넓은 반경)에서 제출 성공, 반경 밖 거부 확인

**전자서명 추가 (2단계 추가 요구사항)**

- [x] 🤖 폼에 서명판(canvas) + [지우기], 서명 필수, 확인 팝업에 서명 표시
- [x] 🤖 서버: PNG 검증 후 드라이브 서명 폴더에 저장, 신청 탭 `서명파일ID` 컬럼 추가 (`setupSheets()` 재실행 시 기존 시트 끝에 컬럼만 추가)
- [x] 🙋 드라이브에 서명 폴더 만들기 (링크 공유 금지) → 폴더 URL의 `/folders/<ID>`를 `SIGNATURE_FOLDER_ID`에 입력
  - 드라이브 구조: 공용 계정의 `1365-auto-log` 폴더 안에 데이터 시트, `PDF` 폴더(4단계 `DRIVE_FOLDER_ID`), `서명` 폴더
- [x] 🙋 편집기에서 `setupSheets()` 실행 → 드라이브 권한 승인 + `서명파일ID` 컬럼 추가 확인
- [x] 🙋 `checkConfig()` 실행 → 로그에 서명 폴더 이름이 나오는지 확인
- [x] 🤖 웹앱 새 버전 배포 (권한 승인 후)
- [x] 🙋 폰으로 서명 제출 → 서명 폴더에 PNG 생성, 신청 탭에 파일 ID 기록 확인

> 쉼터 밖에서 미리 테스트할 때는 스크립트 속성의 좌표를 현재 위치로 두거나 `GEOFENCE_RADIUS_M`을 크게 둡니다. 반경 밖 거부는 반경을 `10`처럼 작게 해서 확인합니다. **테스트 후 실제 좌표·반경으로 되돌리기.**

## 3. 텔레그램 봇 (`telegram`)

- [x] 🙋 BotFather로 봇 생성, 토큰 받기
- [x] 🙋 BotFather `/setprivacy` → Disable (자연어 수정용, **그룹 초대 전에**)
- [x] 🙋 테스트 그룹에 봇 초대, `getUpdates`로 그룹 chat ID·본인 user ID 확인 (운영진은 나중에 `/myid`로 추가)
- [x] 🙋 Script Properties 입력: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_USER_IDS`, `WEBHOOK_SECRET`
- [x] 🙋 Script Properties 추가: `WEBAPP_URL` (웹앱 `.../exec` 주소, Vercel 환경변수와 같은 값)
- [x] 🤖 `Telegram.js`: 메시지 전송, 인라인 버튼, 콜백 처리, 처리자 표시, `/myid`
- [x] 🤖 권한 체크(`ADMIN_USER_IDS`), `update_id` 중복 방지(캐시), `LockService` 잠금, 웹훅 200 응답(HtmlService)
- [x] 🤖 `setWebhook()` (비밀값을 URL 쿼리에 포함), `checkWebhook()`, `sendTestMessage()`
- [x] 🤖 웹앱 새 버전 배포 (@7)
- [x] 🙋 편집기에서 `setWebhook()` 실행 (외부 요청 권한 승인) → `checkWebhook()` → `sendTestMessage()`

**확인**: 그룹에서 테스트 버튼을 누르면 메시지가 수정되고, 허용되지 않은 사용자는 "권한이 없어요", 같은 버튼 재클릭은 "이미 처리된 요청이에요".

- [x] 테스트 그룹에서 `/myid` 응답, 테스트 버튼 처리(처리자 표시·버튼 제거·처리로그 기록) 확인
- [ ] 다른 계정으로 "권한이 없어요" 확인 (운영진 합류 시)

> 스크립트 속성을 고친 뒤에는 **저장 버튼**을 눌러야 반영됩니다. 값에 공백·줄바꿈이 섞이면 설정 검사에서 막힙니다.

## 4. PDF 생성 (`pdf`)

배치(5단계)에 붙이기 전에, 기간을 지정해 수동으로 PDF를 만들고 확인한다.

- [ ] 🙋 hwp 활동일지 양식 확인 (센터 양식) → 화면 캡처나 PDF로 Claude에게 공유
- [ ] 🤖 `createTemplateSheet()`: 양식 템플릿 시트 생성 함수
- [ ] 🙋 함수 실행 후 센터 양식에 맞게 다듬기 → `TEMPLATE_SHEET_ID` 입력
- [x] 🙋 드라이브 PDF 폴더 만들기 (`1365-auto-log/PDF`)
- [ ] 🙋 직인 이미지 업로드 → `DRIVE_FOLDER_ID`(PDF 폴더), `SEAL_IMAGE_FILE_ID` 입력
- [ ] 🙋 `ORG_NAME`, `ACTIVITY_DESC`, `MANAGER_NAME`, `MANAGER_PHONE` 입력
- [ ] 🤖 `Pdf.js`: 기간의 `접수` 건 조회 → 템플릿 복제 → 값 채우기(서명 칸에는 `서명파일ID`의 이미지) → 11명 단위 페이지 분할 → PDF 내보내기 → 드라이브 저장
- [ ] 🤖 수동 실행 함수: 기간을 지정해 PDF 생성 + 텔레그램으로 PDF 전송 (주차 상태는 바꾸지 않음)

**확인**: 3명 / 11명 / 12명(2장)으로 각각 만들어 보고 정렬, 서명 이미지, 직인, 하단 날짜를 눈으로 확인.

## 5. 주간 마감 알림과 작성 버튼 (`trigger`, `telegram`)

- [ ] 🤖 `weeklyClose`: 지난주 월~일 `접수` 건 집계, 주차 행 생성(`마감대기`), ① 마감 알림 + [작성하기]
- [ ] 🤖 신청자 0명 처리 ("지난주 신청자가 없습니다")
- [ ] 🤖 수동 실행용 함수 (날짜 지정 가능)
- [ ] 🤖 [작성하기] → 4단계 PDF 생성 → ② 작성 완료(PDF 첨부) + ③ 발송 확인, 주차 상태 `작성완료` → `발송대기`, 신청 행에 주차ID 기록
- [ ] 🤖 PDF 실패 시 오류 알림 + [다시 작성]

**확인**: 테스트 데이터를 넣고 수동 실행하면 번호 붙은 명단이 텔레그램에 오고, [작성하기]를 누르면 PDF가 온다.

## 6. 메일 발송 (`mail`)

- [ ] 🙋 `MAIL_TO`(테스트 중엔 본인 메일), `MAIL_CC`, `MAIL_SUBJECT`, `MAIL_BODY`, `PDF_FILENAME` 입력
- [ ] 🤖 `Mail.js`: 템플릿 치환(`{org}` `{start}` `{end}` `{count}` `{sent_date}`), 최신 PDF 첨부 필수, 발송
- [ ] 🤖 ③ 발송 확인 + [전송하기], 상태 전이(`발송대기` → `발송완료`), 신청 행 `발송완료`, 중복 발송 방지
- [ ] 🤖 발송 실패 시 오류 알림, 상태 유지

**확인**: 테스트 메일로 한 번 발송되고, [전송하기]를 다시 눌러도 재발송되지 않는다.

## 7. 자연어 수정 (`nlu`)

- [ ] 🙋 LLM API 키 발급 → `LLM_API_KEY`, `LLM_MODEL` 입력
- [ ] 🤖 `Nlu.js`: 프롬프트(JSON 출력 강제) → `{action, target_no, field, value}`, 최소 정보만 전송
- [ ] 🤖 **개인정보 마스킹**: 운영진 메시지 속 연락처·생년월일을 LLM 전송 전에 `<PHONE_1>`, `<BIRTH_1>`로 치환하고, 응답의 자리표시자는 코드에서 원래 값으로 복원 (LLM은 실제 값을 보지 못함)
- [ ] 🤖 마스킹 확인: LLM 요청 본문에 `010-`, `yy.mm.dd` 형식이 남지 않는지 검사하고, 남아 있으면 전송하지 않고 오류 처리
- [ ] 🤖 확인 메시지 + [확인] [취소], 대화상태 탭 저장, 확인 시에만 시트 반영
- [ ] 🤖 동명이인·대상 불명확·형식 오류는 되묻기, 해석 실패 안내
- [ ] 🤖 PDF 생성 후 수정 시 재생성·재전송, `발송완료` 이후는 수정 불가 안내
- [ ] 🤖 수정 이력을 처리로그에 기록 (누가, 어떤 컬럼의 값을 바꿨는지만 기록. 이전값·새값은 어떤 필드든 남기지 않음)

**확인**: "3번 연락처 …로 바꿔줘", "○○ 11/4 10:00~14:00로 추가해줘", "5번 삭제", 애매한 요청 각각 시도. 연락처를 넣은 요청에서 LLM으로 나가는 본문(로그 확인)에 실제 번호가 없고, 확인 메시지에는 복원된 번호가 나오는지 확인.

## 8. 재알림과 개인정보 파기 (`trigger`)

- [ ] 🤖 `weeklyReminder`: 화요일 18~19시, 발송 전이면 현재 단계 버튼과 함께 재알림
- [ ] 🤖 `purgeNotice`: 내일이 1일이면 파기 예정 알림
- [ ] 🤖 `monthlyPurge`: 발송 후 `RETENTION_MONTHS` 지난 주차의 신청 행·PDF·서명 이미지 삭제, 상태 `파기완료`
- [ ] 🤖 `setupTriggers()`
- [ ] 🙋 `setupTriggers()` 수동 실행, 트리거 목록 확인

**확인**: 테스트 주차의 날짜를 조작해 알림·파기가 동작하는지 확인 (메일 보낸편지함은 남아 있어야 함).

## 9. 엔드투엔드 테스트와 운영 시작

- [ ] 🙋 테스트 그룹 + 테스트 수신 메일로 한 주기 전체 실행: 제출 → 마감 알림 → 작성 → 수정 → 재작성 → 발송
- [ ] 🙋 동시 버튼 클릭, 텔레그램 재전송, 발송 실패 등 예외 상황 확인 (PRD 9장 표)
- [ ] 🙋 개인정보 동의 문구를 활동일지 양식의 실제 문구로 교체 (`web/index.html`, 지금은 임시 문구)
- [ ] 🙋 스크립트 속성을 실제 값으로: 쉼터 좌표, `GEOFENCE_RADIUS_M` (**지금 테스트용 100000**), `MAIL_TO`
- [ ] 🙋 쉼터 현장에서 폰으로 최종 확인 (쉼터 안 제출 성공 / 반경 밖 거부)
- [ ] 🙋 실제 운영진 그룹 연결 (`TELEGRAM_CHAT_ID`, 운영진 `/myid` → `ADMIN_USER_IDS`)
- [ ] 🙋 Vercel 주소로 QR 만들기, 현장 부착
- [ ] 🙋 첫 주 모니터링

## 10. 공개 레포 마무리

- [ ] 🤖 README에 최종 함수명·파일 구조 반영 (`createTemplateSheet`, `setupSheets` 등)
- [ ] 🤖 `web/config.example.js`, `.clasp.json.example` 등 예시 파일 정리
- [ ] 🙋 커밋 이력·파일에 토큰, 좌표, 메일, 직인이 없는지 최종 점검
- [ ] 🙋 다른 쉼터가 README만 보고 설치 가능한지 한 번 따라 해 보기

## 진행 메모

**현재 상태 (이어서 작업할 때 먼저 읽기)**

- 2단계까지 끝났습니다 (웹앱 배포, Vercel 호스팅 완료). 3단계 텔레그램까지 끝났습니다 (웹앱 @7, 테스트 그룹 연결). QR, 현장 최종 확인(반경 되돌리기), 동의 문구 교체는 9단계로 옮겼습니다. 다음 작업은 4단계 PDF 생성입니다 (4·5단계 순서를 바꿔 PDF를 먼저 확인하고 배치를 붙임). 자연어 수정 메시지는 지금 운영진 메시지를 받기만 하고 7단계에서 연결합니다. 활동시간은 `TIME_MODE=preset`으로 운영 중입니다. 텔레그램 웹훅(`update_id`)은 지금은 받기만 하고 무시하며 3단계에서 연결합니다.
- **clasp 연결**: `.clasp.json.example`을 `.clasp.json`으로 복사하고 `scriptId`를 채웁니다. `rootDir`가 `gas`라서 `web/`은 Apps Script에 올라가지 않습니다. 이 파일은 `.gitignore` 대상입니다.
- **clasp 로그인**: 레포 안의 `.clasprc.json`에 공용 계정 토큰을 저장합니다 (`npx @google/clasp -A .clasprc.json login`). 이후 명령도 `-A .clasprc.json`을 붙이고, 매니페스트 확인 프롬프트 때문에 push는 `push --force`로 합니다. 이 파일도 `.gitignore` 대상입니다.
- **appsscript.json 선반영**: 웹앱 접근 설정(나로 실행 / 모든 사용자)은 4단계가 아닌 2단계 배포 설정을 미리 넣어 둔 것입니다. 시간대는 `Asia/Seoul`입니다.
- **폼 호스팅 (결정: Vercel)**: Vercel 프로젝트의 Root Directory를 `web`으로 두고 환경변수 `WEBAPP_URL`을 넣으면, 빌드 단계(`web/vercel.json` → `web/build-config.js`)가 `config.js`를 만듭니다. 레포에는 웹앱 URL이 남지 않습니다. 로컬 테스트는 `web/config.example.js`를 `web/config.js`로 복사해서 씁니다.

**공통**


- `clasp push` 뒤에는 열려 있던 Apps Script 편집기 탭을 **반드시 새로고침**합니다. 예전 내용이 열린 채로 저장·배포하면 push한 코드가 옛 코드로 덮어써집니다 (2단계 첫 배포 때 실제로 발생).
- 코드를 고친 뒤에는 새 배포가 아니라 **기존 배포에 새 버전**으로 올립니다 (`clasp deploy -i <배포ID>`). 새 배포를 만들면 웹앱 URL이 바뀝니다.
- 테스트 중에는 `MAIL_TO`를 본인 메일로 두세요.
- Claude Code에 시킬 때: "`docs/TASKS.md`의 N단계를 구현하고, 끝나면 수동 테스트 방법을 알려줘"
