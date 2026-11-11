/**
 * Script Properties 읽기, 필수값 누락 검사
 */

// 비워 두면 이 값을 쓴다.
const CONFIG_DEFAULTS = {
  GEOFENCE_RADIUS_M: '300',
  TIME_MODE: 'free',
  ACTIVITY_WINDOW: '10:00~18:00',
  MAX_ACTIVITY_HOURS: '8',
  TIME_MORNING: '10:00~14:00',
  TIME_AFTERNOON: '14:00~18:00',
  TIME_FULLDAY: '10:00~18:00',
  MAIL_SUBJECT: '[{org}] 자원봉사 활동일지 제출 ({start}~{end})',
  PDF_FILENAME: '{end}_{org}_활동일지.pdf',
  RETENTION_MONTHS: '3',
};

// 형식 검사. 문제가 없으면 빈 문자열, 있으면 안내 문구를 돌려준다.
const CONFIG_VALIDATORS = {
  SHELTER_LAT: (v) => (isNumberInRange_(v, -90, 90) ? '' : '-90~90 사이 숫자여야 해요'),
  SHELTER_LNG: (v) => (isNumberInRange_(v, -180, 180) ? '' : '-180~180 사이 숫자여야 해요'),
  GEOFENCE_RADIUS_M: (v) => (isNumberInRange_(v, 1, 100000) ? '' : '1~100000 사이 숫자(m)여야 해요'),
  TIME_MODE: (v) => (v === 'free' || v === 'preset' ? '' : 'free 또는 preset이어야 해요'),
  ACTIVITY_WINDOW: timeRangeValidator_,
  TIME_MORNING: timeRangeValidator_,
  TIME_AFTERNOON: timeRangeValidator_,
  TIME_FULLDAY: timeRangeValidator_,
  MAX_ACTIVITY_HOURS: (v) => (isNumberInRange_(v, 1, 24) && (Number(v) * 60) % 10 === 0 ? '' : '1~24 사이 숫자여야 해요 (10분 단위)'),
  RETENTION_MONTHS: (v) => (/^[1-9]\d*$/.test(v) ? '' : '1 이상의 정수여야 해요'),
  TELEGRAM_BOT_TOKEN: (v) => (/^\d+:[\w-]+$/.test(v) ? '' : 'BotFather가 준 토큰 형식(숫자:문자열)이어야 해요'),
  TELEGRAM_CHAT_ID: (v) => (/^-?\d+$/.test(v) ? '' : '숫자여야 해요 (그룹은 보통 -100으로 시작)'),
  ADMIN_USER_IDS: (v) => (splitList_(v).every((id) => /^\d+$/.test(id)) ? '' : '쉼표로 구분한 숫자 ID여야 해요'),
  WEBHOOK_SECRET: (v) => (/^[A-Za-z0-9_-]{16,256}$/.test(v) ? '' : '영문·숫자·_·- 16자 이상이어야 해요 (openssl rand -hex 24)'),
  WEBAPP_URL: (v) => (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v) ? '' : '웹앱 URL(https://script.google.com/macros/s/.../exec)이어야 해요'),
};

// 오류 문구에 현재 값을 보여주지 않는 키 (처리로그·실행 로그에 남지 않게)
const SECRET_CONFIG_KEYS = ['TELEGRAM_BOT_TOKEN', 'WEBHOOK_SECRET', 'LLM_API_KEY'];

const TELEGRAM_CONFIG_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ADMIN_USER_IDS', 'WEBHOOK_SECRET'];

// checkConfig()로 확인하는 키. 단계가 진행되면 늘린다. (활동시간 키는 TIME_MODE에 따라 따로 확인)
const BASIC_CONFIG_KEYS = ['SHEET_ID', 'SHELTER_LAT', 'SHELTER_LNG', 'GEOFENCE_RADIUS_M', 'SIGNATURE_FOLDER_ID'];

let configCache_ = null;

function getConfig_(key) {
  if (!configCache_) configCache_ = PropertiesService.getScriptProperties().getProperties();
  const value = String(configCache_[key] || '').trim();
  return value || CONFIG_DEFAULTS[key] || '';
}

// 쉼표 구분 값을 배열로 읽는다. (ADMIN_USER_IDS, MAIL_CC 등)
function getConfigList_(key) {
  return splitList_(getConfig_(key));
}

// 키들을 한 번에 검사하고 값을 객체로 돌려준다. 문제가 있으면 전부 모아서 오류를 낸다.
function requireConfig_(keys) {
  const values = {};
  const problems = [];
  keys.forEach((key) => {
    const value = getConfig_(key);
    if (!value) {
      problems.push(`${key}: 값이 비어 있어요`);
      return;
    }
    const validate = CONFIG_VALIDATORS[key];
    const error = validate ? validate(value) : '';
    if (error) problems.push(SECRET_CONFIG_KEYS.includes(key) ? `${key}: ${error}` : `${key}: ${error} (현재 값: ${value})`);
    values[key] = value;
  });
  if (problems.length) {
    throw new Error(
      '스크립트 속성을 확인해 주세요. (프로젝트 설정 → 스크립트 속성)\n- ' + problems.join('\n- ')
    );
  }
  return values;
}

/**
 * 편집기에서 수동 실행: 기본 설정값과 시트 접근을 확인한다.
 */
function checkConfig() {
  requireConfig_(BASIC_CONFIG_KEYS);
  const rule = getActivityRule_();
  const ss = getSpreadsheet_();
  const signatureFolder = getSignatureFolder_();
  const timeText =
    rule.mode === 'free'
      ? `자유 선택 ${rule.window.start}~${rule.window.end}, 최대 ${rule.maxMinutes / 60}시간`
      : rule.presets.map((p) => `${p.label} ${p.start}~${p.end}`).join(', ');
  Logger.log(`설정 확인 완료: 시트 "${ss.getName()}", 서명 폴더 "${signatureFolder.getName()}", 활동시간 ${timeText}`);
}

function isNumberInRange_(value, min, max) {
  const n = Number(value);
  return value !== '' && isFinite(n) && n >= min && n <= max;
}

function splitList_(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function timeRangeValidator_(v) {
  return parseTimeRange_(v) ? '' : '10분 단위 HH:mm~HH:mm 형식이어야 해요 (예: 10:00~18:00)';
}

// "HH:mm"을 0시부터의 분으로 바꾼다. 형식이 틀리거나 10분 단위가 아니면 null.
function parseTime_(value) {
  const m = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes % 10 === 0 ? minutes : null;
}

// "HH:mm~HH:mm"을 {start, end}(분)로 바꾼다. 시작이 종료보다 늦거나 형식이 틀리면 null.
function parseTimeRange_(value) {
  const parts = String(value || '').split('~').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const start = parseTime_(parts[0]);
  const end = parseTime_(parts[1]);
  return start !== null && end !== null && start < end ? { start, end } : null;
}
