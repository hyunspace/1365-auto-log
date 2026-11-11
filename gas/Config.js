/**
 * Script Properties 읽기, 필수값 누락 검사
 */

// 비워 두면 이 값을 쓴다.
const CONFIG_DEFAULTS = {
  GEOFENCE_RADIUS_M: '300',
  TIME_SLOTS: '10:00~14:00,14:00~18:00',
  MAIL_SUBJECT: '[{org}] 자원봉사 활동일지 제출 ({start}~{end})',
  PDF_FILENAME: '{end}_{org}_활동일지.pdf',
  RETENTION_MONTHS: '3',
};

// 형식 검사. 문제가 없으면 빈 문자열, 있으면 안내 문구를 돌려준다.
const CONFIG_VALIDATORS = {
  SHELTER_LAT: (v) => (isNumberInRange_(v, -90, 90) ? '' : '-90~90 사이 숫자여야 해요'),
  SHELTER_LNG: (v) => (isNumberInRange_(v, -180, 180) ? '' : '-180~180 사이 숫자여야 해요'),
  GEOFENCE_RADIUS_M: (v) => (isNumberInRange_(v, 1, 100000) ? '' : '1 이상의 숫자(m)여야 해요'),
  TIME_SLOTS: (v) => (splitList_(v).length ? '' : '쉼표로 구분한 활동시간이 하나 이상 있어야 해요'),
  RETENTION_MONTHS: (v) => (/^[1-9]\d*$/.test(v) ? '' : '1 이상의 정수여야 해요'),
};

// checkConfig()로 확인하는 키. 단계가 진행되면 늘린다.
const BASIC_CONFIG_KEYS = ['SHEET_ID', 'SHELTER_LAT', 'SHELTER_LNG', 'GEOFENCE_RADIUS_M', 'TIME_SLOTS'];

let configCache_ = null;

function getConfig_(key) {
  if (!configCache_) configCache_ = PropertiesService.getScriptProperties().getProperties();
  const value = String(configCache_[key] || '').trim();
  return value || CONFIG_DEFAULTS[key] || '';
}

// 쉼표 구분 값을 배열로 읽는다. (TIME_SLOTS, ADMIN_USER_IDS, MAIL_CC 등)
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
    if (error) problems.push(`${key}: ${error} (현재 값: ${value})`);
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
  const ss = getSpreadsheet_();
  Logger.log(`설정 확인 완료: 시트 "${ss.getName()}", 활동시간 ${getConfigList_('TIME_SLOTS').join(' / ')}`);
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
