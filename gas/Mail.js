/**
 * 메일 발송, 템플릿 치환
 *
 * MAIL_SUBJECT, MAIL_BODY, PDF_FILENAME의 치환 변수: {org} {start} {end} {count} {sent_date}
 * 스크립트 속성 입력칸은 한 줄이라, MAIL_BODY의 줄바꿈은 \n 으로 적는다.
 */

// [전송하기]: 최신 PDF를 첨부해 MAIL_TO로 보내고 ④ 발송 완료를 알린다. 같은 주차는 한 번만 보낸다.
function handleSendCallback_(query, weekId, updateId) {
  const week = findWeek_(weekId);
  if (!week) {
    answerCallback_(query.id, '주차 정보를 찾을 수 없어요.');
    return;
  }
  if (week['상태'] === WEEK_STATUS.SENT || week['상태'] === WEEK_STATUS.PURGED) {
    answerCallback_(query.id, '이미 처리된 요청이에요.');
    return;
  }
  if (week['상태'] !== WEEK_STATUS.WAITING_SEND) {
    answerCallback_(query.id, `지금은 보낼 수 없어요. (현재 단계: ${week['상태']})`);
    return;
  }
  answerCallback_(query.id, '메일을 보내고 있어요…');

  const name = userName_(query.from);
  const applies = weekApplies_(weekId);
  try {
    sendWeekMail_(week, applies.length);
  } catch (err) {
    appendLog_('오류', { update_id: String(updateId), 처리자: name, 주차ID: weekId, 내용: `메일 발송 실패: ${err.message}` });
    sendMessage_(
      `⚠️ [오류] 메일 발송 실패: ${err.message}\n주차: ${weekId} / 다시 시도하려면 [전송하기]를 눌러주세요.`,
      [[{ text: '전송하기', callback_data: `send:${weekId}` }]]
    );
    return;
  }

  // 발송 직후 상태부터 바꿔 재발송을 막는다.
  const now = new Date();
  updateRecord_(SHEET_NAMES.WEEK, week._row, {
    상태: WEEK_STATUS.SENT,
    '발송 처리자': name,
    발송일시: formatKst_(now, 'yyyy-MM-dd HH:mm:ss'),
  });
  applies.forEach((r) => updateRecord_(SHEET_NAMES.APPLY, r._row, { 진행상태: '발송완료' }));
  appendLog_('버튼', { update_id: String(updateId), 처리자: name, 주차ID: weekId, 내용: 'send' });

  if (query.message.text && query.message.text.indexOf('✅') === -1) markProcessed_(query.message, `✅ 전송 (by ${name})`);
  const today = formatKst_(now, 'yyyy-MM-dd');
  sendMessage_(`메일을 발송했습니다. (by ${name}, ${formatKoreanDate_(today)} ${formatKst_(now, 'HH:mm')})`);
}

function sendWeekMail_(week, count) {
  const config = requireConfig_(['MAIL_TO', 'MAIL_SUBJECT', 'MAIL_BODY', 'ORG_NAME']);
  const pdfId = String(week['PDF 파일 ID'] || '');
  if (!pdfId) throw new Error('첨부할 PDF가 없어요. 활동일지를 먼저 작성해 주세요.');
  let pdf;
  try {
    pdf = DriveApp.getFileById(pdfId);
    if (pdf.isTrashed()) throw new Error('휴지통에 있어요');
  } catch (err) {
    throw new Error(`첨부할 PDF를 열 수 없어요. (${err.message})`);
  }

  const vars = {
    org: config.ORG_NAME,
    start: week['시작일'],
    end: week['종료일'],
    count,
    sent_date: todayKst_(),
  };
  const options = {
    to: config.MAIL_TO,
    subject: fillTemplate_(config.MAIL_SUBJECT, vars),
    body: fillTemplate_(config.MAIL_BODY, vars).replace(/\\n/g, '\n'),
    name: config.ORG_NAME,
    attachments: [pdf.getBlob().setName(pdf.getName())],
  };
  const cc = getConfigList_('MAIL_CC').join(',');
  if (cc) options.cc = cc;
  MailApp.sendEmail(options);
}

// '2026-11-10' → '26년 11월 10일 화'
function formatKoreanDate_(yyyyMMdd) {
  const [y, m, d] = String(yyyyMMdd).split('-').map(Number);
  return `${String(y).slice(2)}년 ${m}월 ${d}일 ${WEEKDAY_NAMES[weekdayIndex_(yyyyMMdd)]}`;
}
