# 작업 목록 (Tasks)

[PRD](PRD.md) 10장 구현 순서를 기준으로 정리했습니다. 위에서부터 순서대로 진행하고, 각 단계 끝의 **확인** 항목을 통과하면 다음 단계로 넘어갑니다.

- 🙋 = 직접 해야 하는 작업 (계정 권한, 앱 설정 등)
- 🤖 = Claude Code에게 시키는 작업 (코드 작성)
- 커밋 스코프는 [CLAUDE.md](../CLAUDE.md)를 따릅니다.
- 준비해야 할 설정값과 API 키 목록은 [.env.example](../.env.example)에 정리되어 있습니다. 실제 값은 Apps Script의 Script Properties에 입력합니다.

## 0. 사전 준비

- [ ] 🙋 쉼터 공용 Gmail 계정 준비 (이후 모든 작업은 이 계정으로)
- [ ] 🙋 구글 시트 새로 만들고 Apps Script 프로젝트 생성
- [ ] 🙋 [Apps Script API](https://script.google.com/home/usersettings) 켜기
- [ ] 🙋 `npm i -g @google/clasp` → `clasp login` (공용 계정)
- [ ] 🙋 프로젝트 설정에서 시간대 `Asia/Seoul` 확인
- [ ] 🙋 테스트용 텔레그램 그룹 + 테스트 수신용 메일 준비
- [ ] 🙋 쉼터 정확한 좌표와 허용 반경 정하기 (PRD 미정 사항)
- [x] 🙋 자연어 수정에 쓸 LLM 정하기: **Gemini Flash 무료 티어로 결정** (무료 티어는 입력이 서비스 개선에 쓰일 수 있어 마스킹 필수, 7단계 참고)
- [x] 🤖 `chore`: 레포 뼈대 (`web/`, `gas/`, `appsscript.json`, `.clasp.json.example`), `.gitignore`
- [ ] 🙋 `.clasp.json.example`을 `.clasp.json`으로 복사하고 `scriptId` 입력
- [ ] 🙋 `web/config.example.js`를 `web/config.js`로 복사 (웹앱 URL은 4단계 배포 후 입력)

**확인**: `clasp push`가 성공하고 편집기에서 코드가 보인다.

> `.clasp.json`의 scriptId, `web/config.js`는 쉼터별 값이므로 `.gitignore`에 넣고, 예시 파일(`*.example`)만 커밋합니다.

## 1. 시트 구조와 설정 (`gas`, `sheet`)

- [ ] 🤖 `Config.js`: Script Properties 읽기, 필수값 누락 시 오류 알림
- [ ] 🤖 `Sheet.js` + `setupSheets()`: 신청 / 주차 / 대화상태 / 처리로그 탭과 컬럼 생성 (생년월일·연락처는 텍스트 서식)
- [ ] 🙋 Script Properties 1차 입력: `SHEET_ID`, `SHELTER_LAT/LNG`, `GEOFENCE_RADIUS_M`, `TIME_SLOTS`
- [ ] 🙋 `setupSheets()` 수동 실행, 권한 승인

**확인**: 시트에 탭 4개와 컬럼이 생기고, 값을 하나 지우면 오류가 뜬다.

## 2. 봉사자 폼과 제출 처리 (`form`, `gas`)

- [ ] 🤖 `Main.js`: `doGet`(TIME_SLOTS 반환) / `doPost` 라우팅 (`update_id` 유무로 웹훅·폼 구분)
- [ ] 🤖 `Form.js`: 하버사인 거리 검증, 중복 체크(봉사일자+이름+생년월일), 레이트 리밋, 행 추가
- [ ] 🤖 `web/`: 입력 폼, 위치 권한 요청, 형식 검증, `text/plain` POST, 완료·실패 화면
- [ ] 🙋 웹앱 배포 (실행: 나 / 액세스: 모든 사용자), URL을 `web/config.js`에 입력
- [ ] 🙋 Vercel 또는 GitHub Pages로 폼 호스팅, QR 만들기
- [ ] 🙋 `clasp deploy -i <배포ID>`로 URL 유지되는지 확인

**확인 (폰으로 현장 테스트)**: 쉼터 안 제출 성공 / 반경 밖 거부 / 위치 거부 시 버튼 비활성 / 같은 사람 재제출 거부.

## 3. 텔레그램 봇 (`telegram`)

- [ ] 🙋 BotFather로 봇 생성, 토큰 받기
- [ ] 🙋 운영진 그룹에 봇 초대, 그룹 chat ID·운영진 user ID 확인
- [ ] 🙋 BotFather `/setprivacy` → Disable (자연어 수정용)
- [ ] 🙋 Script Properties 입력: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_USER_IDS`, `WEBHOOK_SECRET`
- [ ] 🤖 `Telegram.js`: 메시지 전송, 인라인 버튼, 콜백 처리, 처리자 표시
- [ ] 🤖 권한 체크(`ADMIN_USER_IDS`), `update_id` 중복 방지, `LockService` 주차 잠금
- [ ] 🤖 `setWebhook()` (비밀값을 URL 쿼리에 포함)
- [ ] 🙋 `setWebhook()` 수동 실행

**확인**: 그룹에서 테스트 버튼을 누르면 메시지가 수정되고, 허용되지 않은 사용자는 "권한이 없어요", 같은 버튼 재클릭은 "이미 처리된 요청이에요".

## 4. 주간 마감 알림 (`trigger`, `telegram`)

- [ ] 🤖 `weeklyClose`: 지난주 월~일 `접수` 건 집계, 주차 행 생성(`마감대기`), ① 마감 알림 + [작성하기]
- [ ] 🤖 신청자 0명 처리 ("지난주 신청자가 없습니다")
- [ ] 🤖 수동 실행용 함수 (날짜 지정 가능)

**확인**: 테스트 데이터를 넣고 수동 실행하면 번호 붙은 명단이 텔레그램에 온다.

## 5. PDF 생성 (`pdf`)

- [ ] 🙋 hwp 활동일지 양식 확인 (센터 양식)
- [ ] 🤖 `createTemplateSheet()`: 양식 템플릿 시트 생성 함수
- [ ] 🙋 함수 실행 후 센터 양식에 맞게 다듬기 → `TEMPLATE_SHEET_ID` 입력
- [ ] 🙋 드라이브 PDF 폴더 만들고 직인 이미지 업로드 → `DRIVE_FOLDER_ID`, `SEAL_IMAGE_FILE_ID` 입력
- [ ] 🙋 `ORG_NAME`, `ACTIVITY_DESC`, `MANAGER_NAME`, `MANAGER_PHONE` 입력
- [ ] 🤖 `Pdf.js`: 템플릿 복제 → 값 채우기 → 11명 단위 페이지 분할 → PDF 내보내기 → 드라이브 저장 → 텔레그램 전송 (`작성완료`)
- [ ] 🤖 PDF 실패 시 오류 알림 + [다시 작성]

**확인**: 3명 / 11명 / 12명(2장)으로 각각 만들어 보고 정렬, 동의 "○", 직인, 하단 날짜를 눈으로 확인.

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
- [ ] 🤖 `monthlyPurge`: 발송 후 `RETENTION_MONTHS` 지난 주차의 신청 행·PDF 삭제, 상태 `파기완료`
- [ ] 🤖 `setupTriggers()`
- [ ] 🙋 `setupTriggers()` 수동 실행, 트리거 목록 확인

**확인**: 테스트 주차의 날짜를 조작해 알림·파기가 동작하는지 확인 (메일 보낸편지함은 남아 있어야 함).

## 9. 엔드투엔드 테스트

- [ ] 🙋 테스트 그룹 + 테스트 수신 메일로 한 주기 전체 실행: 제출 → 마감 알림 → 작성 → 수정 → 재작성 → 발송
- [ ] 🙋 동시 버튼 클릭, 텔레그램 재전송, 발송 실패 등 예외 상황 확인 (PRD 9장 표)
- [ ] 🙋 `MAIL_TO`를 실제 수신자로 변경, 실제 그룹 연결
- [ ] 🙋 현장 QR 부착, 첫 주 모니터링

## 10. 공개 레포 마무리

- [ ] 🤖 README에 최종 함수명·파일 구조 반영 (`createTemplateSheet`, `setupSheets` 등)
- [ ] 🤖 `web/config.example.js`, `.clasp.json.example` 등 예시 파일 정리
- [ ] 🙋 커밋 이력·파일에 토큰, 좌표, 메일, 직인이 없는지 최종 점검
- [ ] 🙋 다른 쉼터가 README만 보고 설치 가능한지 한 번 따라 해 보기

## 진행 메모

**현재 상태 (이어서 작업할 때 먼저 읽기)**

- 0단계의 🤖 항목은 끝났습니다. `gas/`의 `.js` 파일은 역할만 적은 빈 파일이고, `web/`은 최소 골격입니다. 다음 🤖 작업은 1단계(`Config.js`, `Sheet.js`, `setupSheets()`)입니다.
- **clasp 연결**: `.clasp.json.example`을 `.clasp.json`으로 복사하고 `scriptId`를 채웁니다. `rootDir`가 `gas`라서 `web/`은 Apps Script에 올라가지 않습니다. 이 파일은 `.gitignore` 대상입니다.
- **폼 설정**: `web/config.example.js`를 `web/config.js`로 복사해 웹앱 URL을 넣습니다. 이 파일도 `.gitignore` 대상입니다.
- **appsscript.json 선반영**: 웹앱 접근 설정(나로 실행 / 모든 사용자)은 4단계가 아닌 2단계 배포 설정을 미리 넣어 둔 것입니다. 시간대는 `Asia/Seoul`입니다.
- **미해결 (2단계에서 결정)**: GitHub Pages로 폼을 호스팅하면 `config.js`가 `.gitignore` 대상이라 배포 시점에 그 파일이 없을 수 있습니다. 호스팅 방식(Vercel 환경변수·빌드 단계 / `config.js` 별도 배포 / 웹앱 URL을 공개 값으로 보고 커밋)을 2단계 시작 전에 정합니다.

**공통**


- 코드를 고친 뒤에는 새 배포가 아니라 **기존 배포에 새 버전**으로 올립니다 (`clasp deploy -i <배포ID>`). 새 배포를 만들면 웹앱 URL이 바뀝니다.
- 테스트 중에는 `MAIL_TO`를 본인 메일로 두세요.
- Claude Code에 시킬 때: "`docs/TASKS.md`의 N단계를 구현하고, 끝나면 수동 테스트 방법을 알려줘"
