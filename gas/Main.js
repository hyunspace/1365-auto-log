/**
 * doGet / doPost 라우팅 (update_id 유무로 텔레그램 웹훅과 폼 제출 구분)
 */

const TIME_ZONE = 'Asia/Seoul';

// 폼이 처음 열릴 때 활동시간 선택 범위를 내려받는다.
function doGet() {
  const config = requireConfig_(['ACTIVITY_WINDOW', 'MAX_ACTIVITY_HOURS']);
  const [start, end] = config.ACTIVITY_WINDOW.split('~').map((s) => s.trim());
  return jsonResponse_({
    ok: true,
    window: { start, end },
    maxMinutes: Number(config.MAX_ACTIVITY_HOURS) * 60,
    stepMinutes: TIME_STEP_MINUTES,
  });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return jsonResponse_({ ok: false, code: 'INVALID', message: '요청 형식이 올바르지 않아요.' });
  }

  // 텔레그램 웹훅은 3단계에서 Telegram.js로 연결한다.
  if (body && body.update_id !== undefined) return jsonResponse_({ ok: true });

  return jsonResponse_(handleFormSubmit_(body || {}));
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function formatKst_(date, pattern) {
  return Utilities.formatDate(date, TIME_ZONE, pattern);
}

// 처리로그 탭에 한 줄 남긴다. 연락처·생년월일은 넣지 않는다.
function appendLog_(type, fields) {
  appendRecord_(SHEET_NAMES.LOG, Object.assign({ 일시: formatKst_(new Date(), 'yyyy-MM-dd HH:mm:ss'), 구분: type }, fields));
}
