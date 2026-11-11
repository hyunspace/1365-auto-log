/**
 * 폼 제출 처리: 지오펜스, 중복 체크, 레이트 리밋
 */

// 같은 연락처로 RATE_LIMIT_WINDOW_SEC 동안 RATE_LIMIT_MAX번까지만 시도할 수 있다.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 600;

// 첫 글자는 반드시 문자 (수식으로 해석될 수 있는 =, +, - 등으로 시작하지 않게)
const NAME_PATTERN = /^[가-힣a-zA-Z][가-힣a-zA-Z .-]{0,19}$/;
const BIRTH_PATTERN = /^(\d{2})\.(\d{2})\.(\d{2})$/;
const PHONE_PATTERN = /^(01[016789])(\d{3,4})(\d{4})$/;

function handleFormSubmit_(data) {
  let input;
  try {
    input = validateSubmission_(data);
  } catch (err) {
    return { ok: false, code: 'INVALID', message: err.message };
  }

  try {
    if (isRateLimited_(input.phone)) {
      return { ok: false, code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' };
    }

    const shelter = requireConfig_(['SHELTER_LAT', 'SHELTER_LNG', 'GEOFENCE_RADIUS_M']);
    const distance = Math.round(
      distanceMeters_(Number(shelter.SHELTER_LAT), Number(shelter.SHELTER_LNG), input.lat, input.lng)
    );
    if (distance > Number(shelter.GEOFENCE_RADIUS_M)) {
      return { ok: false, code: 'OUT_OF_RANGE', message: '쉼터 안에서만 제출할 수 있어요.' };
    }

    const now = new Date();
    const volunteerDate = formatKst_(now, 'yyyy-MM-dd');

    // 중복 확인과 행 추가 사이에 다른 제출이 끼어들지 않게 잠근다.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const duplicated = readRecords_(SHEET_NAMES.APPLY).some(
        (r) => String(r['봉사일자']) === volunteerDate && String(r['이름']) === input.name && String(r['생년월일']) === input.birth
      );
      if (duplicated) {
        return { ok: false, code: 'DUPLICATE', message: '오늘 이미 제출하셨어요.' };
      }
      appendRecord_(SHEET_NAMES.APPLY, {
        봉사일자: volunteerDate,
        이름: input.name,
        생년월일: input.birth,
        연락처: input.phone,
        활동시간: input.timeSlot,
        정보제공동의: 'Y',
        진행상태: '접수',
        작성일시: formatKst_(now, 'yyyy-MM-dd HH:mm:ss'),
        '거리(m)': distance,
      });
    } finally {
      lock.releaseLock();
    }
    return { ok: true, name: input.name, date: volunteerDate };
  } catch (err) {
    console.error(`폼 제출 처리 실패: ${err.message}`);
    try {
      appendLog_('오류', { 내용: `폼 제출 처리 실패: ${err.message}` });
    } catch (logErr) {
      console.error(`처리로그 기록 실패: ${logErr.message}`);
    }
    return { ok: false, code: 'SERVER_ERROR', message: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' };
  }
}

// 입력값을 검증하고 저장할 형태로 정리한다. 문제가 있으면 사용자에게 보여줄 문구로 오류를 낸다.
function validateSubmission_(data) {
  const name = String(data.name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_PATTERN.test(name)) throw new Error('이름을 확인해 주세요.');

  const birth = String(data.birth || '').trim();
  const b = birth.match(BIRTH_PATTERN);
  if (!b || Number(b[2]) < 1 || Number(b[2]) > 12 || Number(b[3]) < 1 || Number(b[3]) > 31) {
    throw new Error('생년월일을 예시처럼 입력해 주세요. (예: 95.03.12)');
  }

  const p = String(data.phone || '').replace(/\D/g, '').match(PHONE_PATTERN);
  if (!p) throw new Error('연락처를 확인해 주세요. (예: 010-1234-5678)');
  const phone = `${p[1]}-${p[2]}-${p[3]}`;

  const timeSlot = String(data.timeSlot || '');
  if (!getConfigList_('TIME_SLOTS').includes(timeSlot)) throw new Error('활동시간을 선택해 주세요.');

  if (data.consent !== true) throw new Error('개인정보 제공에 동의해야 제출할 수 있어요.');

  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (data.lat === undefined || data.lng === undefined || !isFinite(lat) || !isFinite(lng)) {
    throw new Error('위치를 확인할 수 없어요. 위치 권한을 허용해 주세요.');
  }

  return { name, birth, phone, timeSlot, lat, lng };
}

// 시도 횟수를 세고 한도를 넘었는지 돌려준다. 캐시 키에는 연락처 대신 해시를 쓴다.
function isRateLimited_(phone) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, phone);
  const key = 'rate_' + Utilities.base64EncodeWebSafe(digest);
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), RATE_LIMIT_WINDOW_SEC);
  return count > RATE_LIMIT_MAX;
}

// 하버사인 공식으로 두 좌표 사이 거리(m)를 구한다.
function distanceMeters_(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
