/**
 * 시트 접근 헬퍼, setupSheets()
 */

const SHEET_NAMES = {
  APPLY: '신청',
  WEEK: '주차',
  PENDING: '대화상태',
  LOG: '처리로그',
};

// 탭별 컬럼. numeric에 없는 컬럼은 텍스트 서식으로 둔다.
// (생년월일·연락처·날짜 문자열이 시트에서 날짜나 숫자로 자동 변환되는 것을 막는다)
const SHEET_SCHEMAS = {
  [SHEET_NAMES.APPLY]: {
    headers: ['봉사일자', '이름', '생년월일', '연락처', '활동시간', '정보제공동의', '진행상태', '작성일시', '거리(m)', '주차ID', '서명파일ID'],
    numeric: ['거리(m)'],
  },
  [SHEET_NAMES.WEEK]: {
    headers: ['주차ID', '시작일', '종료일', '상태', '신청자수', 'PDF 파일 ID', '작성 승인자', '발송 처리자', '발송일시', '파기일시'],
    numeric: ['신청자수'],
  },
  [SHEET_NAMES.PENDING]: {
    headers: ['요청ID', '주차ID', '명령JSON', '요청자', '생성시각'],
    numeric: [],
  },
  // 연락처·생년월일과 수정 전후 값은 기록하지 않는다 (PRD 9장).
  [SHEET_NAMES.LOG]: {
    headers: ['일시', '구분', 'update_id', '처리자', '주차ID', '내용'],
    numeric: [],
  },
};

// 새 스프레드시트에 기본으로 있는 탭. 비어 있으면 setupSheets()가 지운다.
const DEFAULT_SHEET_NAMES = ['시트1', 'Sheet1'];

let spreadsheetCache_ = null;

/**
 * 편집기에서 수동 실행: 탭 4개와 머리글, 컬럼 서식을 만든다.
 * 여러 번 실행해도 기존 데이터는 건드리지 않는다. 뒤에 새로 생긴 컬럼은 끝에 덧붙인다.
 */
function setupSheets() {
  const ss = getSpreadsheet_();
  const created = [];
  Object.keys(SHEET_SCHEMAS).forEach((name) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      created.push(name);
    }
    applySchema_(sheet, SHEET_SCHEMAS[name]);
  });

  DEFAULT_SHEET_NAMES.forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() === 0 && sheet.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
    }
  });

  Logger.log(created.length ? `탭 생성: ${created.join(', ')}` : '모든 탭이 이미 있어요. 머리글과 서식만 확인했어요.');
}

function getSpreadsheet_() {
  if (spreadsheetCache_) return spreadsheetCache_;
  const id = requireConfig_(['SHEET_ID']).SHEET_ID;
  try {
    spreadsheetCache_ = SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(`SHEET_ID로 시트를 열 수 없어요. ID가 맞는지, 이 계정에 권한이 있는지 확인해 주세요. (${e.message})`);
  }
  return spreadsheetCache_;
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(`'${name}' 탭이 없어요. setupSheets()를 먼저 실행해 주세요.`);
  return sheet;
}

// 머리글 이름을 키로 하는 객체를 한 행으로 추가하고, 추가된 행 번호를 돌려준다.
function appendRecord_(name, record) {
  const sheet = getSheet_(name);
  const schema = SHEET_SCHEMAS[name];
  const rowNumber = sheet.getLastRow() + 1;
  if (rowNumber > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);

  const row = schema.headers.map((h) => (record[h] === undefined || record[h] === null ? '' : record[h]));
  sheet
    .getRange(rowNumber, 1, 1, row.length)
    .setNumberFormats([columnFormats_(schema)])
    .setValues([row]);
  return rowNumber;
}

// 기존 행(rowNumber)의 일부 컬럼만 바꾼다. fields는 머리글 이름을 키로 하는 객체
function updateRecord_(name, rowNumber, fields) {
  const sheet = getSheet_(name);
  const schema = SHEET_SCHEMAS[name];
  Object.keys(fields).forEach((header) => {
    const col = schema.headers.indexOf(header) + 1;
    if (!col) throw new Error(`'${name}' 탭에 '${header}' 컬럼이 없어요.`);
    sheet
      .getRange(rowNumber, col)
      .setNumberFormat(schema.numeric.includes(header) ? '0' : '@')
      .setValue(fields[header]);
  });
}

// 데이터 행을 머리글 이름을 키로 하는 객체 배열로 읽는다. _row에 시트 행 번호를 담는다.
function readRecords_(name) {
  const sheet = getSheet_(name);
  const headers = SHEET_SCHEMAS[name].headers;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, headers.length)
    .getValues()
    .map((values, i) => {
      const record = { _row: i + 2 };
      headers.forEach((h, j) => (record[h] = values[j]));
      return record;
    });
}

function applySchema_(sheet, schema) {
  const headers = schema.headers;
  const lastColumn = sheet.getLastColumn();
  if (lastColumn > 0) {
    const current = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const isPrefix = current.length < headers.length && current.every((h, i) => h === headers[i]);
    if (isPrefix) {
      // 기존 머리글 뒤에 새 컬럼만 추가 (예: 서명파일ID)
      const added = headers.slice(current.length);
      sheet.getRange(1, current.length + 1, 1, added.length).setValues([added]).setFontWeight('bold');
      Logger.log(`'${sheet.getName()}' 탭에 컬럼 추가: ${added.join(', ')}`);
    } else if (current.join('|') !== headers.join('|')) {
      throw new Error(
        `'${sheet.getName()}' 탭의 1행 머리글이 예상과 달라요.\n` +
          `예상: ${headers.join(', ')}\n현재: ${current.join(', ')}\n` +
          '데이터가 없다면 탭을 지우고 다시 실행해 주세요.'
      );
    }
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  }
  sheet.setFrozenRows(1);

  if (sheet.getMaxRows() < 2) sheet.insertRowsAfter(1, 100);
  const formats = columnFormats_(schema);
  const rows = sheet.getMaxRows() - 1;
  sheet.getRange(2, 1, rows, headers.length).setNumberFormats(Array(rows).fill(formats));
}

function columnFormats_(schema) {
  return schema.headers.map((h) => (schema.numeric.includes(h) ? '0' : '@'));
}
