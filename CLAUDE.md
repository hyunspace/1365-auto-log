# 커밋 메시지 컨벤션 (Conventional Commits)
- 프리픽스와 스코프를 제외한 메시지는 한글로 작성한다.

**기본 프리픽스**
| 프리픽스 | 용도 | 예시 |
| --- | --- | --- |
| `feat` | 새 기능 | `feat(form): 위치 확인 후 제출 버튼 활성화` |
| `fix` | 버그 수정 | `fix(pdf): 11명 초과 시 페이지 분할 오류 수정` |
| `docs` | 문서 (README, PRD) | `docs: 설치 가이드 추가` |
| `refactor` | 동작 변화 없는 구조 개선 | `refactor(sheet): 시트 접근 헬퍼 분리` |
| `style` | 포맷, CSS 등 화면 스타일 | `style(form): 모바일 입력창 간격 조정` |
| `chore` | 설정, 빌드, 의존성 | `chore: clasp 설정 추가` |
| `test` | 테스트 코드 | `test(nlu): 수정 요청 파싱 케이스 추가` |

**이 프로젝트용 스코프**
- `form`: 봉사자 입력 폼 (web/)
- `gas`: Google Apps Script 공통 설정
- `sheet`: 시트 읽기/쓰기
- `pdf`: 활동일지 PDF 생성
- `telegram`: 봇 메시지, 버튼
- `nlu`: 자연어 수정 (LLM)
- `mail`: 메일 발송
- `trigger`: 주간 생성, 재알림, 파기 배치