// 위치 확인, 형식 검증, POST (Content-Type: text/plain → CORS preflight 회피)
(function () {
  const WEBAPP_URL = (window.APP_CONFIG && window.APP_CONFIG.WEBAPP_URL) || '';

  const $ = (id) => document.getElementById(id);
  const form = $('apply-form');
  const submitButton = $('submit');
  const locationStatus = $('location-status');
  const retryButton = $('retry-location');
  const formError = $('form-error');
  const startSelect = $('start-time');
  const endSelect = $('end-time');
  const timeTotal = $('time-total');
  const dialog = $('confirm-dialog');

  // timeRule: 서버 doGet이 내려주는 활동시간 규칙
  //   free:   { mode, window: {start, end}, maxMinutes, stepMinutes }
  //   preset: { mode, presets: [{key, label, start, end}] }
  const state = { position: null, timeRule: null, sending: false };

  function updateSubmitButton() {
    submitButton.disabled = !(state.position && state.timeRule) || state.sending;
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

  // ---------- 활동시간 (free: 시작·종료 시각 선택 / preset: 오전·오후·종일) ----------

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function toHHMM(minutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m}분`;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }

  function fillOptions(select, placeholder, values, selected) {
    select.innerHTML = '';
    select.append(new Option(placeholder, ''));
    values.forEach((v) => select.append(new Option(toHHMM(v), toHHMM(v))));
    select.value = values.includes(selected) ? toHHMM(selected) : '';
  }

  // 시작 시각에 맞춰 종료 시각 선택지를 (시작+10분 ~ 시작+최대시간, 활동 가능 시간 안) 다시 만든다.
  function updateEndOptions() {
    const rule = state.timeRule;
    const previousEnd = endSelect.value ? toMinutes(endSelect.value) : null;
    if (!startSelect.value) {
      fillOptions(endSelect, '종료', [], null);
      endSelect.disabled = true;
    } else {
      const start = toMinutes(startSelect.value);
      const last = Math.min(start + rule.maxMinutes, toMinutes(rule.window.end));
      const ends = [];
      for (let t = start + rule.stepMinutes; t <= last; t += rule.stepMinutes) ends.push(t);
      fillOptions(endSelect, '종료', ends, previousEnd);
      endSelect.disabled = false;
    }
    updateTimeTotal();
  }

  function updateTimeTotal() {
    const minutes = selectedMinutes();
    timeTotal.textContent = minutes ? `총 ${formatDuration(minutes)}` : '시작 시각과 종료 시각을 선택해 주세요.';
  }

  function selectedMinutes() {
    if (!startSelect.value || !endSelect.value) return 0;
    return toMinutes(endSelect.value) - toMinutes(startSelect.value);
  }

  function setupFreeMode(rule) {
    $('time-rule').textContent = `(${rule.window.start}~${rule.window.end}, 최대 ${formatDuration(rule.maxMinutes)})`;
    const starts = [];
    for (let t = toMinutes(rule.window.start); t < toMinutes(rule.window.end); t += rule.stepMinutes) starts.push(t);
    fillOptions(startSelect, '시작', starts, null);
    updateEndOptions();
    $('time-free').hidden = false;
  }

  function setupPresetMode(rule) {
    const container = $('time-presets');
    container.innerHTML = '';
    rule.presets.forEach((preset) => {
      const label = document.createElement('label');
      label.className = 'check';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'preset';
      input.value = preset.key;
      label.append(input, ` ${presetText(preset)}`);
      container.append(label);
    });
    container.hidden = false;
    timeTotal.hidden = true;
  }

  function presetText(preset) {
    const minutes = toMinutes(preset.end) - toMinutes(preset.start);
    return `${preset.label} ${preset.start}~${preset.end} (총 ${formatDuration(minutes)})`;
  }

  function selectedPreset() {
    const checked = form.querySelector('input[name="preset"]:checked');
    return checked ? state.timeRule.presets.find((p) => p.key === checked.value) : null;
  }

  function loadTimeRule() {
    fetch(WEBAPP_URL)
      .then((res) => res.json())
      .then((rule) => {
        if (!rule.ok) throw new Error();
        if (rule.mode === 'preset' && rule.presets && rule.presets.length) setupPresetMode(rule);
        else if (rule.mode === 'free' && rule.window) setupFreeMode(rule);
        else throw new Error();
        state.timeRule = rule;
        updateSubmitButton();
      })
      .catch(() => {
        timeTotal.textContent = '활동시간을 불러오지 못했어요. 새로고침해 주세요.';
        timeTotal.className = 'error';
      });
  }

  startSelect.addEventListener('change', updateEndOptions);
  endSelect.addEventListener('change', updateTimeTotal);

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
    if (state.timeRule.mode === 'preset') {
      if (!values.preset) return '활동시간(오전·오후·종일)을 선택해 주세요.';
    } else if (!values.startTime || !values.endTime) {
      return '활동 시작·종료 시각을 선택해 주세요.';
    }
    if (!values.consent) return '개인정보 제공에 동의해야 제출할 수 있어요.';
    return '';
  }

  // ---------- 제출 전 확인 팝업 ----------

  function summaryRows(values) {
    return [
      ['이름', values.name],
      ['생년월일', values.birth],
      ['연락처', values.phone],
      ['활동시간', activityText()],
      ['개인정보 제공 동의', '동의'],
    ];
  }

  function activityText() {
    const preset = selectedPreset();
    if (preset) return presetText(preset);
    return `${startSelect.value}~${endSelect.value} (총 ${formatDuration(selectedMinutes())})`;
  }

  // 사용자가 [제출하기]를 누르면 true로 끝나는 Promise
  function confirmSubmission(values) {
    const rows = summaryRows(values);
    if (typeof dialog.showModal !== 'function') {
      const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
      return Promise.resolve(window.confirm(`${text}\n\n위 내용으로 제출하시겠습니까?\n제출 후에는 수정할 수 없습니다.`));
    }

    const summary = $('confirm-summary');
    summary.innerHTML = '';
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      summary.append(dt, dd);
    });

    return new Promise((resolve) => {
      const finish = (ok) => {
        $('confirm-ok').onclick = null;
        $('confirm-cancel').onclick = null;
        dialog.onclose = null;
        if (dialog.open) dialog.close();
        resolve(ok);
      };
      $('confirm-ok').onclick = () => finish(true);
      $('confirm-cancel').onclick = () => finish(false);
      dialog.onclose = () => finish(false); // ESC, 뒤로가기 등
      dialog.showModal();
    });
  }

  // ---------- 제출 ----------

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.sending) return;

    const values = {
      name: $('name').value.trim(),
      birth: $('birth').value.trim(),
      phone: $('phone').value.trim(),
      consent: $('consent').checked,
    };
    // 모드에 맞는 활동시간만 보낸다. (preset이면 시각은 서버가 스크립트 속성에서 정한다)
    if (state.timeRule.mode === 'preset') {
      const preset = selectedPreset();
      values.preset = preset ? preset.key : '';
    } else {
      values.startTime = startSelect.value;
      values.endTime = endSelect.value;
    }
    const error = validate(values);
    showError(error);
    if (error) return;

    confirmSubmission(values).then((ok) => {
      if (ok) send(values);
    });
  });

  function send(values) {
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
          body: JSON.stringify(Object.assign({}, values, { lat: pos.coords.latitude, lng: pos.coords.longitude })),
        });
      })
      .then((res) => res.json())
      .then((result) => {
        if (!result.ok) {
          showError(result.message || '제출하지 못했어요.');
          return;
        }
        $('done-message').textContent = `${result.name}님, ${result.date} 활동일지가 제출됐어요.`;
        $('form-view').hidden = true;
        $('done-view').hidden = false;
      })
      .catch(() => showError('제출하지 못했어요. 위치 권한과 인터넷 연결을 확인하고 다시 시도해 주세요.'))
      .finally(() => {
        state.sending = false;
        submitButton.textContent = '제출하기';
        updateSubmitButton();
      });
  }

  if (!WEBAPP_URL) {
    locationStatus.textContent = '설정 오류: 웹앱 URL이 없어요. (config.js 확인)';
    locationStatus.className = 'status error';
    return;
  }
  loadTimeRule();
  checkLocation();
})();
