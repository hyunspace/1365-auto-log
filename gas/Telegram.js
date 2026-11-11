/**
 * 텔레그램 메시지, 버튼, 콜백, setWebhook()
 */

// 처리한 update_id를 기억하는 시간(초). 텔레그램 재전송은 이 안에 들어온다. (CacheService 최대 6시간)
const UPDATE_DEDUP_SEC = 21600;

// 버튼 callback_data는 "동작:인자" 형식 (최대 64바이트). 동작별 처리 함수를 돌려준다.
// 다른 파일의 함수는 파일 로드 순서와 상관없게 호출 시점에 찾는다.
function callbackHandler_(action) {
  switch (action) {
    case 'test':
      return handleTestCallback_;
    case 'write':
      return handleWriteCallback_;
    case 'send':
      return handleSendCallback_;
    default:
      return null;
  }
}

/**
 * 편집기에서 수동 실행: 텔레그램 웹훅을 이 웹앱으로 등록한다.
 * Apps Script는 요청 헤더를 읽을 수 없으므로 비밀값을 URL 쿼리에 붙인다 (PRD 9장).
 */
function setWebhook() {
  const config = requireConfig_(TELEGRAM_CONFIG_KEYS.concat(['WEBAPP_URL']));
  telegramApi_('setWebhook', {
    url: `${config.WEBAPP_URL}?secret=${encodeURIComponent(config.WEBHOOK_SECRET)}`,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  Logger.log('웹훅 등록 완료. checkWebhook()으로 상태를 확인하고, sendTestMessage()로 버튼을 시험해 보세요.');
}

/**
 * 편집기에서 수동 실행: 웹훅 상태를 확인한다. (비밀값이 든 URL 쿼리는 로그에 남기지 않는다)
 */
function checkWebhook() {
  const info = telegramApi_('getWebhookInfo', {});
  const lines = [
    `등록된 URL: ${info.url ? info.url.split('?')[0] : '(없음)'}`,
    `대기 중인 업데이트: ${info.pending_update_count}`,
  ];
  if (info.last_error_message) {
    const at = info.last_error_date ? formatKst_(new Date(info.last_error_date * 1000), 'yyyy-MM-dd HH:mm:ss') : '';
    lines.push(`마지막 오류: ${info.last_error_message} (${at})`);
  }
  Logger.log(lines.join('\n'));
}

/**
 * 편집기에서 수동 실행: 운영진 그룹에 테스트 버튼 메시지를 보낸다.
 */
function sendTestMessage() {
  const id = Date.now().toString(36);
  sendMessage_('🔧 텔레그램 연결 테스트\n아래 버튼을 눌러 보세요.', [[{ text: '테스트', callback_data: `test:${id}` }]]);
  Logger.log('테스트 메시지를 보냈어요. 그룹에서 버튼을 눌러 보세요.');
}

// doPost에서 호출. 비밀값이 맞을 때만 처리하고, 오류가 나도 텔레그램에는 항상 200으로 답한다.
function handleTelegramWebhook_(e, update) {
  try {
    const secret = (e && e.parameter && e.parameter.secret) || '';
    if (!secret || secret !== getConfig_('WEBHOOK_SECRET')) return telegramOk_();
    if (isDuplicateUpdate_(update.update_id)) return telegramOk_();

    if (update.callback_query) handleCallbackQuery_(update.callback_query, update.update_id);
    else if (update.message) handleMessage_(update.message);
  } catch (err) {
    console.error(`텔레그램 처리 실패: ${err.message}`);
    try {
      appendLog_('오류', { update_id: String(update.update_id), 내용: `텔레그램 처리 실패: ${err.message}` });
    } catch (logErr) {
      console.error(`처리로그 기록 실패: ${logErr.message}`);
    }
  }
  return telegramOk_();
}

// ContentService 응답은 302 리다이렉트로 나가 텔레그램이 오류로 보고 재전송할 수 있어 HtmlService로 200을 돌려준다.
function telegramOk_() {
  return HtmlService.createHtmlOutput('ok');
}

function isDuplicateUpdate_(updateId) {
  const cache = CacheService.getScriptCache();
  const key = `update_${updateId}`;
  if (cache.get(key)) return true;
  cache.put(key, '1', UPDATE_DEDUP_SEC);
  return false;
}

// ---------- 메시지 ----------

function handleMessage_(message) {
  if (String(message.chat.id) !== getConfig_('TELEGRAM_CHAT_ID')) return; // 운영진 그룹 외에는 무시
  const text = String(message.text || '').trim();

  // /myid 또는 /myid@봇이름: 운영진 등록용으로 누구나 쓸 수 있다.
  if (/^\/myid(@\w+)?$/.test(text)) {
    sendMessage_(`${userName_(message.from)}님의 user ID: ${message.from.id}\n운영진으로 등록하려면 스크립트 속성 ADMIN_USER_IDS에 추가하세요.`, null, message.message_id);
    return;
  }

  if (!isAdmin_(message.from)) return; // 허용되지 않은 사용자의 메시지는 무시
  // 자연어 수정 요청은 7단계에서 Nlu.js로 연결한다.
}

// ---------- 버튼 ----------

function handleCallbackQuery_(query, updateId) {
  if (!isAdmin_(query.from)) {
    answerCallback_(query.id, '권한이 없어요.');
    return;
  }
  const [action, arg] = String(query.data || '').split(':');
  const handler = callbackHandler_(action);
  if (!handler) {
    answerCallback_(query.id, '알 수 없는 버튼이에요.');
    return;
  }

  // 같은 버튼을 동시에 눌러도 한 번만 처리되게 잠근다.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    handler(query, arg, updateId);
  } catch (err) {
    try {
      answerCallback_(query.id, '처리 중 오류가 났어요. 잠시 후 다시 눌러 주세요.');
    } catch (answerErr) {
      // 응답까지 실패하면 버튼 로딩 표시만 남는다. 원래 오류를 기록하는 게 우선
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// 테스트 버튼: 처음 누르면 메시지에 처리자를 남기고 버튼을 없앤다. 다시 누르면 "이미 처리된 요청이에요".
function handleTestCallback_(query, testId, updateId) {
  const cache = CacheService.getScriptCache();
  const key = `test_done_${testId}`;
  if (cache.get(key)) {
    answerCallback_(query.id, '이미 처리된 요청이에요.');
    return;
  }
  cache.put(key, '1', UPDATE_DEDUP_SEC);

  const name = userName_(query.from);
  markProcessed_(query.message, `✅ 테스트 확인 (by ${name})`);
  answerCallback_(query.id, '처리했어요.');
  appendLog_('버튼', { update_id: String(updateId), 처리자: name, 내용: 'test' });
}

// 원래 메시지 아래에 처리 결과를 붙이고 버튼을 없앤다.
function markProcessed_(message, line) {
  telegramApi_('editMessageText', {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: `${message.text}\n\n${line}`,
  });
}

// ---------- 공통 ----------

function isAdmin_(user) {
  return Boolean(user) && getConfigList_('ADMIN_USER_IDS').includes(String(user.id));
}

function userName_(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id);
}

// 운영진 그룹으로 메시지를 보낸다. buttons는 인라인 버튼 2차원 배열
function sendMessage_(text, buttons, replyToMessageId) {
  const payload = { chat_id: requireConfig_(['TELEGRAM_CHAT_ID']).TELEGRAM_CHAT_ID, text };
  if (buttons) payload.reply_markup = { inline_keyboard: buttons };
  if (replyToMessageId) payload.reply_parameters = { message_id: replyToMessageId };
  return telegramApi_('sendMessage', payload);
}

function answerCallback_(callbackQueryId, text) {
  telegramApi_('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// 텔레그램 Bot API 호출. 오류 문구에 토큰이 든 URL이 섞이지 않게 정리해서 던진다.
// multipart: 파일(blob)을 보낼 때 true (sendDocument 등)
function telegramApi_(method, payload, multipart) {
  const token = requireConfig_(['TELEGRAM_BOT_TOKEN']).TELEGRAM_BOT_TOKEN;
  const options = multipart
    ? { method: 'post', payload, muteHttpExceptions: true }
    : { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  let response;
  try {
    response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/${method}`, options);
  } catch (err) {
    throw new Error(`텔레그램 ${method} 요청 실패: ${String(err.message).split(token).join('<TOKEN>')}`);
  }
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (err) {
    throw new Error(`텔레그램 ${method} 응답을 읽을 수 없어요 (HTTP ${response.getResponseCode()})`);
  }
  if (!result.ok) throw new Error(`텔레그램 ${method} 실패: ${result.description || response.getResponseCode()}`);
  return result.result;
}
