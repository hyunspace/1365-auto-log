/**
 * 주차 진행: ① 마감 알림 → [작성하기] → ② PDF 전송 + ③ 발송 확인 [전송하기]
 *
 * 주차 상태: 마감대기 → 작성완료 → 발송대기 → 발송완료 → 파기완료 (PRD 5장)
 * 날짜는 모두 'yyyy-MM-dd' 문자열로 다루고, 날짜 계산은 UTC 기준 Date로 한다 (시간대 영향 없음).
 */

const WEEK_STATUS = {
  CLOSED: '마감대기',
  WRITTEN: '작성완료',
  WAITING_SEND: '발송대기',
  SENT: '발송완료',
  PURGED: '파기완료',
};
const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/**
 * 트리거로 매주 화요일 실행 (8단계 setupTriggers에서 등록): 지난주 월~일을 마감한다.
 */
function weeklyClose() {
  closeWeek(addDays_(todayKst_(), -7));
}

/**
 * 편집기에서 수동 실행: date가 속한 주(월~일)를 마감하고 ① 마감 알림을 보낸다.
 * 예: closeWeek('2026-11-12') → 2026-11-09(월) ~ 2026-11-15(일)
 * 이번 주를 시험할 때는 closeThisWeekForTest()를 쓴다.
 */
function closeWeek(date) {
  const start = mondayOf_(date);
  const end = addDays_(start, 6);
  const weekId = isoWeekId_(start);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const existing = findWeek_(weekId);
    if (existing && existing['상태'] !== WEEK_STATUS.CLOSED) {
      throw new Error(`${weekId}는 이미 '${existing['상태']}' 상태예요. 다시 마감하려면 resetWeekForTest('${weekId}')를 먼저 실행하세요.`);
    }

    const applies = readRecords_(SHEET_NAMES.APPLY).filter(
      (r) => String(r['진행상태']) === '접수' && String(r['봉사일자']) >= start && String(r['봉사일자']) <= end
    );
    if (!applies.length) {
      sendMessage_(`${formatRange_(start, end)}\n지난주 신청자가 없습니다.`);
      Logger.log(`${weekId}: 신청자 없음`);
      return;
    }

    applies.forEach((r) => updateRecord_(SHEET_NAMES.APPLY, r._row, { 주차ID: weekId }));
    if (existing) {
      updateRecord_(SHEET_NAMES.WEEK, existing._row, { 신청자수: applies.length });
    } else {
      appendRecord_(SHEET_NAMES.WEEK, { 주차ID: weekId, 시작일: start, 종료일: end, 상태: WEEK_STATUS.CLOSED, 신청자수: applies.length });
    }
  } finally {
    lock.releaseLock();
  }

  sendCloseNotice_(weekId);
  Logger.log(`${weekId} 마감 알림을 보냈어요.`);
}

/**
 * 편집기에서 수동 실행 (시험용): 이번 주(월~일)를 바로 마감한다.
 */
function closeThisWeekForTest() {
  closeWeek(todayKst_());
}

/**
 * 편집기에서 수동 실행 (시험용): 주차를 처음 상태로 되돌린다.
 * 주차 행을 지우고, 해당 신청 행의 주차ID를 비우고 진행상태를 '접수'로 돌린다. PDF 파일은 남겨 둔다.
 * 예: resetWeekForTest('2026-W46')
 */
function resetWeekForTest(weekId) {
  const week = findWeek_(weekId);
  readRecords_(SHEET_NAMES.APPLY)
    .filter((r) => String(r['주차ID']) === weekId)
    .forEach((r) => updateRecord_(SHEET_NAMES.APPLY, r._row, { 주차ID: '', 진행상태: '접수' }));
  if (week) getSheet_(SHEET_NAMES.WEEK).deleteRow(week._row);
  Logger.log(`${weekId}를 처음 상태로 되돌렸어요.`);
}

// ① 마감 알림: 번호 붙인 명단 + [작성하기]
function sendCloseNotice_(weekId) {
  const week = findWeek_(weekId);
  const applies = weekApplies_(weekId);
  const lines = applies.map((r, i) =>
    [`${i + 1}.`, shortDateWithDay_(r['봉사일자']), r['이름'], r['생년월일'], r['연락처'], r['활동시간']].join(' ')
  );
  const text =
    `${formatRange_(week['시작일'], week['종료일'])} / 1365 봉사시간 신청자: ${applies.length}명\n\n` +
    `${lines.join('\n')}\n\n활동일지를 작성할까요? 수정할 내용이 있으면 메시지로 알려주세요.`;
  sendMessage_(text, [[{ text: '작성하기', callback_data: `write:${weekId}` }]]);
}

// [작성하기] / [다시 작성]: PDF를 만들어 ② 작성 완료 + ③ 발송 확인을 보낸다.
function handleWriteCallback_(query, weekId, updateId) {
  const week = findWeek_(weekId);
  if (!week) {
    answerCallback_(query.id, '주차 정보를 찾을 수 없어요.');
    return;
  }
  if (week['상태'] !== WEEK_STATUS.CLOSED) {
    answerCallback_(query.id, '이미 처리된 요청이에요.');
    return;
  }
  answerCallback_(query.id, '활동일지를 작성하고 있어요…');

  const name = userName_(query.from);
  const applies = weekApplies_(weekId);
  let file;
  try {
    file = createActivityPdf_(applies, week['시작일'], week['종료일']);
  } catch (err) {
    appendLog_('오류', { update_id: String(updateId), 처리자: name, 주차ID: weekId, 내용: `PDF 생성 실패: ${err.message}` });
    sendMessage_(
      `⚠️ [오류] 활동일지 작성 실패: ${err.message}\n주차: ${weekId} / 다시 시도하려면 [다시 작성]을 눌러주세요.`,
      [[{ text: '다시 작성', callback_data: `write:${weekId}` }]]
    );
    return;
  }

  updateRecord_(SHEET_NAMES.WEEK, week._row, { 상태: WEEK_STATUS.WRITTEN, 'PDF 파일 ID': file.getId(), '작성 승인자': name });
  if (query.message.text && query.message.text.indexOf('✅') === -1) markProcessed_(query.message, `✅ 작성 승인 (by ${name})`);
  appendLog_('버튼', { update_id: String(updateId), 처리자: name, 주차ID: weekId, 내용: 'write' });

  sendPdfToTelegram_(file, `활동일지를 작성했습니다. 확인 부탁드립니다. (총 ${applies.length}명)`);
  sendSendConfirm_(weekId);
  updateRecord_(SHEET_NAMES.WEEK, week._row, { 상태: WEEK_STATUS.WAITING_SEND });
}

// ③ 발송 확인 + [전송하기]
function sendSendConfirm_(weekId) {
  const to = getConfig_('MAIL_TO');
  sendMessage_(`활동일지를 담당자${to ? `(${to})` : ''}에게 전송할까요?`, [[{ text: '전송하기', callback_data: `send:${weekId}` }]]);
}

// ---------- 주차·날짜 도우미 ----------

function findWeek_(weekId) {
  return readRecords_(SHEET_NAMES.WEEK).find((r) => String(r['주차ID']) === weekId) || null;
}

function weekApplies_(weekId) {
  return readRecords_(SHEET_NAMES.APPLY)
    .filter((r) => String(r['주차ID']) === weekId && String(r['진행상태']) === '접수')
    .sort((a, b) => String(a['봉사일자']).localeCompare(String(b['봉사일자'])) || String(a['작성일시']).localeCompare(String(b['작성일시'])));
}

function todayKst_() {
  return formatKst_(new Date(), 'yyyy-MM-dd');
}

function parseDay_(yyyyMMdd) {
  const [y, m, d] = String(yyyyMMdd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDay_(date) {
  return date.toISOString().slice(0, 10);
}

function addDays_(yyyyMMdd, days) {
  const date = parseDay_(yyyyMMdd);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDay_(date);
}

// 0=월 … 6=일
function weekdayIndex_(yyyyMMdd) {
  return (parseDay_(yyyyMMdd).getUTCDay() + 6) % 7;
}

function mondayOf_(yyyyMMdd) {
  return addDays_(yyyyMMdd, -weekdayIndex_(yyyyMMdd));
}

// ISO 주차: 그 주 목요일이 속한 해와 주 번호. 예: '2026-11-09' → '2026-W46'
function isoWeekId_(yyyyMMdd) {
  const thursday = parseDay_(addDays_(mondayOf_(yyyyMMdd), 3));
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / 86400000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// '2026-11-03' → '11/3 월'
function shortDateWithDay_(yyyyMMdd) {
  return `${shortDate_(yyyyMMdd)} ${WEEKDAY_NAMES[weekdayIndex_(yyyyMMdd)]}`;
}

// '26년 11월 3일 월 ~ 11월 9일 일' (연도가 바뀌면 끝에도 연도를 붙인다)
function formatRange_(start, end) {
  const endText = formatKoreanDate_(end);
  return `${formatKoreanDate_(start)} ~ ${start.slice(0, 4) !== end.slice(0, 4) ? endText : endText.replace(/^\d+년 /, '')}`;
}
