// 위치 확인, 형식 검증, POST (Content-Type: text/plain → CORS preflight 회피)
(function () {
  const WEBAPP_URL = (window.APP_CONFIG && window.APP_CONFIG.WEBAPP_URL) || '';

  const $ = (id) => document.getElementById(id);
  const form = $('apply-form');
  const submitButton = $('submit');
  const locationStatus = $('location-status');
  const retryButton = $('retry-location');
  const formError = $('form-error');

  const state = { position: null, slotsLoaded: false, sending: false };

  function updateSubmitButton() {
    submitButton.disabled = !(state.position && state.slotsLoaded) || state.sending;
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  // ---------- 위치 ----------

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('이 브라우저는 위치 확인을 지원하지 않아요.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
    });
  }

  function checkLocation() {
    locationStatus.textContent = '위치를 확인하고 있어요…';
    locationStatus.className = 'status';
    retryButton.hidden = true;
    state.position = null;
    updateSubmitButton();

    getPosition()
      .then((pos) => {
        state.position = pos;
        locationStatus.textContent = '위치 확인 완료';
        locationStatus.className = 'status ok';
      })
      .catch(() => {
        locationStatus.textContent = '위치를 확인할 수 없어요. 위치 권한을 허용하고 쉼터에서 접속해 주세요.';
        locationStatus.className = 'status error';
        retryButton.hidden = false;
      })
      .finally(updateSubmitButton);
  }

  retryButton.addEventListener('click', checkLocation);

  // ---------- 활동시간 ----------

  function loadTimeSlots() {
    const container = $('time-slots');
    fetch(WEBAPP_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !data.timeSlots || !data.timeSlots.length) throw new Error();
        container.innerHTML = '';
        data.timeSlots.forEach((slot, i) => {
          const label = document.createElement('label');
          label.className = 'check';
          const input = document.createElement('input');
          input.type = 'radio';
          input.name = 'timeSlot';
          input.value = slot;
          input.required = true;
          if (data.timeSlots.length === 1 && i === 0) input.checked = true;
          label.append(input, ' ' + slot);
          container.append(label);
        });
        state.slotsLoaded = true;
        updateSubmitButton();
      })
      .catch(() => {
        container.innerHTML = '<p class="error">활동시간을 불러오지 못했어요. 새로고침해 주세요.</p>';
      });
  }

  // ---------- 입력 형식 (입력하는 동안 . 과 - 를 자동으로 넣는다) ----------

  function formatBirth(value) {
    const d = value.replace(/\D/g, '').slice(0, 6);
    return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)].filter(Boolean).join('.');
  }

  function formatPhone(value) {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    const middle = d.length === 10 ? 3 : 4;
    return `${d.slice(0, 3)}-${d.slice(3, 3 + middle)}-${d.slice(3 + middle)}`;
  }

  $('birth').addEventListener('input', (e) => (e.target.value = formatBirth(e.target.value)));
  $('phone').addEventListener('input', (e) => (e.target.value = formatPhone(e.target.value)));

  function validate(values) {
    if (!values.name) return '이름을 입력해 주세요.';
    if (!/^\d{2}\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/.test(values.birth)) {
      return '생년월일을 예시처럼 입력해 주세요. (예: 95.03.12)';
    }
    if (!/^01[016789]-\d{3,4}-\d{4}$/.test(values.phone)) return '연락처를 확인해 주세요. (예: 010-1234-5678)';
    if (!values.timeSlot) return '활동시간을 선택해 주세요.';
    if (!values.consent) return '개인정보 제공에 동의해야 제출할 수 있어요.';
    return '';
  }

  // ---------- 제출 ----------

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.sending) return;

    const checked = form.querySelector('input[name="timeSlot"]:checked');
    const values = {
      name: $('name').value.trim(),
      birth: $('birth').value.trim(),
      phone: $('phone').value.trim(),
      timeSlot: checked ? checked.value : '',
      consent: $('consent').checked,
    };
    const error = validate(values);
    showError(error);
    if (error) return;

    state.sending = true;
    submitButton.textContent = '제출하는 중…';
    updateSubmitButton();

    // 제출 시점의 위치를 다시 받아 보낸다.
    getPosition()
      .then((pos) => {
        state.position = pos;
        return fetch(WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(
            Object.assign(values, { lat: pos.coords.latitude, lng: pos.coords.longitude })
          ),
        });
      })
      .then((res) => res.json())
      .then((result) => {
        if (!result.ok) {
          showError(result.message || '제출하지 못했어요.');
          return;
        }
        $('done-message').textContent = `${result.name}님, ${result.date} 봉사 신청이 접수됐어요.`;
        $('form-view').hidden = true;
        $('done-view').hidden = false;
      })
      .catch(() => showError('제출하지 못했어요. 위치 권한과 인터넷 연결을 확인하고 다시 시도해 주세요.'))
      .finally(() => {
        state.sending = false;
        submitButton.textContent = '제출하기';
        updateSubmitButton();
      });
  });

  if (!WEBAPP_URL) {
    locationStatus.textContent = '설정 오류: 웹앱 URL이 없어요. (config.js 확인)';
    locationStatus.className = 'status error';
    return;
  }
  loadTimeSlots();
  checkLocation();
})();
