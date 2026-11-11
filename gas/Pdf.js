/**
 * 활동일지 PDF 생성: 템플릿 채우기, 행 늘리기, 서명·직인 넣기, 내보내기
 *
 * 템플릿 시트는 createTemplateSheet()가 센터 양식(docs의 「자원봉사자 활동 일지」)을 본떠 만든다.
 * 만든 뒤 시트에서 글꼴·문구(접수처 등)를 다듬어도 되고, 아래 이름 붙은 범위와 {자리표시자}만 유지하면 된다.
 *   - 이름 붙은 범위 DATA_ROWS: 명단 칸 (기본 11행 × 8열). 11명을 넘으면 그 아래로 행을 늘린다.
 *   - 이름 붙은 범위 SEAL_CELL: 기관 직인을 얹을 칸, MANAGER_SEAL_CELL: 담당자 도장을 얹을 칸
 *     (없으면 「(직인)」, 「(인)」이라고만 적힌 칸을 찾는다)
 *   - 자리표시자: {ORG_NAME} {ORG_HEAD_NAME} {MANAGER_NAME} {MANAGER_PHONE} {DOC_DATE}
 */

const TEMPLATE_MIN_ROWS = 11;
// 명단 칸 순서: 연번, 일자, 성명, 생년월일, 연락처, 활동시간, 활동내용, 본인서명/정보제공 동의
const TEMPLATE_COLUMN_WIDTHS = [44, 52, 74, 80, 118, 104, 200, 112];
const TEMPLATE_DATA_ROW_HEIGHT = 40;
const SIGNATURE_IMAGE_HEIGHT = 34;
const SEAL_IMAGE_HEIGHT = 56;
// 시트에 넣을 수 있는 이미지 형식 (HEIC·WEBP·SVG·PDF는 안 됨)
const SHEET_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

/**
 * 편집기에서 수동 실행: 활동일지 양식 템플릿 시트를 데이터 시트와 같은 폴더에 만들고 TEMPLATE_SHEET_ID에 저장한다.
 */
function createTemplateSheet() {
  const existing = getConfig_('TEMPLATE_SHEET_ID');
  if (existing) {
    throw new Error('TEMPLATE_SHEET_ID가 이미 있어요. 새로 만들려면 스크립트 속성에서 값을 지우고 다시 실행해 주세요.');
  }

  const ss = SpreadsheetApp.create('1365 활동일지 양식');
  const parent = DriveApp.getFileById(getSpreadsheet_().getId()).getParents();
  if (parent.hasNext()) DriveApp.getFileById(ss.getId()).moveTo(parent.next());

  const sheet = ss.getSheets()[0].setName('활동일지');
  buildTemplateLayout_(ss, sheet);

  PropertiesService.getScriptProperties().setProperty('TEMPLATE_SHEET_ID', ss.getId());
  Logger.log(`템플릿을 만들고 TEMPLATE_SHEET_ID에 저장했어요: ${ss.getUrl()}\n접수처 문구는 시트에서 센터에 맞게 고쳐 주세요.`);
}

function buildTemplateLayout_(ss, sheet) {
  const cols = TEMPLATE_COLUMN_WIDTHS.length;
  sheet.getRange(1, 1, 40, cols).setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  TEMPLATE_COLUMN_WIDTHS.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  const solid = SpreadsheetApp.BorderStyle.SOLID;
  const row = (r) => sheet.getRange(r, 1, 1, cols);

  // 제목, 활동기관
  sheet.getRange('A2:F2').merge().setValue('자원봉사자 활동 일지').setFontSize(18).setHorizontalAlignment('center')
    .setBorder(null, null, true, null, null, null, '#9e9393', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sheet.setRowHeight(2, 48);
  sheet.getRange('C4:H4').merge().setValue('◆ 활동기관 : {ORG_NAME}').setHorizontalAlignment('center');

  // 머리글 2줄
  sheet.getRange('A5:E5').merge().setValue('자원봉사자 인적사항');
  sheet.getRange('F5:H5').merge().setValue('자원봉사 활동사항');
  sheet.getRange('A6:H6').setValues([['연번', '일자', '성 명', '생년월일', '연락처', '활동시간\n(00:00~24:00)', '활동내용', '본인서명/\n정보제공 동의']]);
  sheet.getRange('A5:H6').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setRowHeight(5, 36).setRowHeight(6, 44);

  // 예시 행 + 명단 11행
  sheet.getRange('A7:H7').setValues([['예시', '1/1', '홍길동', '12.34.56', '010-0000-0000', '10:00~14:00', '', '']]);
  const dataStart = 8;
  const data = sheet.getRange(dataStart, 1, TEMPLATE_MIN_ROWS, cols);
  data.offset(0, 0, TEMPLATE_MIN_ROWS, 1).setValues(Array.from({ length: TEMPLATE_MIN_ROWS }, (_, i) => [i + 1]));
  sheet.getRange(7, 1, TEMPLATE_MIN_ROWS + 1, cols).setHorizontalAlignment('center').setNumberFormat('@');
  sheet.setRowHeights(7, TEMPLATE_MIN_ROWS + 1, TEMPLATE_DATA_ROW_HEIGHT);
  sheet.getRange(5, 1, TEMPLATE_MIN_ROWS + 3, cols).setBorder(true, true, true, true, true, true, '#000000', solid);
  ss.setNamedRange('DATA_ROWS', data);

  // 하단: 동의 문구, 확인, 기관·담당자
  const f = dataStart + TEMPLATE_MIN_ROWS + 1; // 명단 아래 한 줄 띄움
  row(f).merge().setValue(
    "※ 본인은 '자원봉사자 활동일지'에 기재한 개인정보를 1365자원봉사포털에 실적등록의 목적으로\n" +
      '   자원봉사센터에 제공하는 것을 동의합니다.\n' +
      "※ 자원봉사자의 신상정보는 '개인정보보호법'에 따라 보호됩니다."
  ).setFontWeight('bold').setFontSize(9).setVerticalAlignment('top');
  sheet.setRowHeight(f, 58);
  row(f + 1).merge().setValue('위와 같이 활동하였음을 확인합니다.').setFontSize(13).setHorizontalAlignment('center');
  row(f + 2).merge().setValue('{DOC_DATE}').setHorizontalAlignment('center');
  sheet.getRange(f + 3, 1, 1, 3).merge().setValue('기관명: {ORG_NAME}').setHorizontalAlignment('left');
  sheet.getRange(f + 3, 4).setValue('(직인)').setHorizontalAlignment('center');
  sheet.getRange(f + 3, 5, 1, 4).merge().setValue('기관(시설)장: {ORG_HEAD_NAME}').setHorizontalAlignment('left');
  sheet.getRange(f + 4, 1, 1, 3).merge().setValue('담당자: {MANAGER_NAME}').setHorizontalAlignment('left');
  sheet.getRange(f + 4, 4).setValue('(인)').setHorizontalAlignment('center');
  sheet.getRange(f + 4, 5, 1, 4).merge().setValue('연락처: {MANAGER_PHONE}').setHorizontalAlignment('left');
  sheet.setRowHeights(f + 1, 4, 32);
  sheet.getRange(f, 1, 6, cols).setBorder(true, true, true, true, null, null, '#000000', solid);
  ss.setNamedRange('SEAL_CELL', sheet.getRange(f + 3, 4));
  ss.setNamedRange('MANAGER_SEAL_CELL', sheet.getRange(f + 4, 4));

  // 접수처 (센터마다 다르므로 시트에서 고쳐 쓴다)
  const r = f + 6;
  sheet.getRange(r, 1, 1, 2).merge().setValue('접 수 처').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange(r, 3, 1, 6).merge()
    .setValue('○○구자원봉사센터 ☏ 000-0000 (FAX 000-0000)\nE-mail: center@example.com  ※팩스 송부 후 유선전화 요망')
    .setFontWeight('bold');
  sheet.setRowHeight(r, 48);
  sheet.getRange(r, 1, 1, cols).setBorder(true, true, true, true, true, null, '#000000', solid);

  sheet.setFrozenRows(0);
  sheet.setHiddenGridlines(true);
  const extra = sheet.getMaxColumns() - cols;
  if (extra > 0) sheet.deleteColumns(cols + 1, extra);
}

/**
 * 편집기에서 수동 실행: 기간을 지정해 PDF를 만들고 텔레그램으로 보낸다. 주차 상태는 바꾸지 않는다.
 * 예: createPdfForRange('2026-11-03', '2026-11-09')
 */
function createPdfForRange(startDate, endDate) {
  const records = readRecords_(SHEET_NAMES.APPLY).filter(
    (r) => String(r['진행상태']) === '접수' && String(r['봉사일자']) >= startDate && String(r['봉사일자']) <= endDate
  );
  if (!records.length) throw new Error(`${startDate} ~ ${endDate} 기간에 '접수' 상태 신청이 없어요.`);
  const file = createActivityPdf_(records, startDate, endDate);
  sendPdfToTelegram_(file, `[PDF 확인용] ${startDate} ~ ${endDate} 활동일지 (총 ${records.length}명)`);
  Logger.log(`PDF 생성: ${file.getName()} (${records.length}명) ${file.getUrl()}`);
}

/**
 * 편집기에서 수동 실행: 가짜 명단 n명으로 PDF를 만들어 본다. 시트에는 아무것도 쓰지 않는다.
 * 서명 칸에는 신청 탭에 있는 첫 번째 서명 이미지를 재사용한다.
 */
function testPdf3() {
  testPdf_(3);
}
function testPdf11() {
  testPdf_(11);
}
function testPdf12() {
  testPdf_(12);
}

function testPdf_(count) {
  const sample = readRecords_(SHEET_NAMES.APPLY).find((r) => r['서명파일ID']);
  const today = formatKst_(new Date(), 'yyyy-MM-dd');
  const records = Array.from({ length: count }, (_, i) => ({
    봉사일자: today,
    이름: `테스트${i + 1}`,
    생년월일: '00.01.01',
    연락처: '010-0000-0000',
    활동시간: '10:00~14:00',
    작성일시: `${today} 10:${String(i).padStart(2, '0')}:00`,
    서명파일ID: sample ? sample['서명파일ID'] : '',
  }));
  const file = createActivityPdf_(records, today, today, 'TEST_');
  sendPdfToTelegram_(file, `[테스트 PDF] 가짜 명단 ${count}명`);
  Logger.log(`테스트 PDF: ${file.getName()} ${file.getUrl()}`);
}

// 신청 기록으로 PDF를 만들어 PDF 폴더에 저장하고 파일을 돌려준다.
function createActivityPdf_(records, startDate, endDate, filePrefix) {
  const config = requireConfig_([
    'TEMPLATE_SHEET_ID', 'DRIVE_FOLDER_ID', 'SEAL_IMAGE_FILE_ID', 'MANAGER_SEAL_FILE_ID',
    'ORG_NAME', 'ACTIVITY_DESC', 'MANAGER_NAME', 'MANAGER_PHONE', 'PDF_FILENAME',
  ]);
  const folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
  const sorted = records.slice().sort((a, b) =>
    String(a['봉사일자']).localeCompare(String(b['봉사일자'])) || String(a['작성일시']).localeCompare(String(b['작성일시']))
  );
  const now = new Date();

  // 템플릿 복사본에 채운 뒤 PDF로 내보내고, 복사본은 지운다.
  const copy = DriveApp.getFileById(config.TEMPLATE_SHEET_ID).makeCopy(`작성중_${Utilities.getUuid()}`, folder);
  try {
    const ss = SpreadsheetApp.openById(copy.getId());
    const sheet = ss.getSheets()[0];

    const placeholders = {
      '{ORG_NAME}': config.ORG_NAME,
      '{ORG_HEAD_NAME}': getConfig_('ORG_HEAD_NAME'),
      '{MANAGER_NAME}': config.MANAGER_NAME,
      '{MANAGER_PHONE}': config.MANAGER_PHONE,
      '{DOC_DATE}': formatKst_(now, 'yyyy년 M월 d일'),
    };
    Object.keys(placeholders).forEach((key) => sheet.createTextFinder(key).replaceAllWith(placeholders[key]));

    const dataRange = ss.getRangeByName('DATA_ROWS');
    if (!dataRange) throw new Error("템플릿에 이름 붙은 범위 'DATA_ROWS'가 없어요.");
    const firstRow = dataRange.getRow();
    const cols = dataRange.getNumColumns();
    const rowCount = Math.max(dataRange.getNumRows(), sorted.length);
    if (rowCount > dataRange.getNumRows()) {
      // 마지막 명단 행 아래로 행을 늘리고 서식을 복사한다. (하단 확인란은 그만큼 아래로 밀린다)
      const lastRow = firstRow + dataRange.getNumRows() - 1;
      const extra = rowCount - dataRange.getNumRows();
      sheet.insertRowsAfter(lastRow, extra);
      sheet.getRange(lastRow, 1, 1, cols).copyTo(sheet.getRange(lastRow + 1, 1, extra, cols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sheet.setRowHeights(lastRow + 1, extra, sheet.getRowHeight(lastRow));
    }

    const values = Array.from({ length: rowCount }, (_, i) => {
      const r = sorted[i];
      if (!r) return [i + 1, '', '', '', '', '', '', ''];
      return [i + 1, shortDate_(r['봉사일자']), r['이름'], r['생년월일'], r['연락처'], r['활동시간'], config.ACTIVITY_DESC, ''];
    });
    sheet.getRange(firstRow, 1, rowCount, cols).setNumberFormat('@').setValues(values);

    // 서명 이미지: 같은 파일은 한 번만 읽는다.
    const blobs = {};
    sorted.forEach((r, i) => {
      const id = String(r['서명파일ID'] || '');
      if (!id) return;
      if (!blobs[id]) blobs[id] = DriveApp.getFileById(id).getBlob();
      placeImage_(sheet, blobs[id], firstRow + i, cols, SIGNATURE_IMAGE_HEIGHT);
    });

    placeSeal_(ss, sheet, 'SEAL_CELL', '(직인)', config.SEAL_IMAGE_FILE_ID, '기관 직인');
    placeSeal_(ss, sheet, 'MANAGER_SEAL_CELL', '(인)', config.MANAGER_SEAL_FILE_ID, '담당자 도장');

    SpreadsheetApp.flush();
    const pdf = exportSheetPdf_(ss.getId(), sheet.getSheetId());
    const name = fillTemplate_(config.PDF_FILENAME, {
      org: config.ORG_NAME,
      start: startDate,
      end: endDate,
      count: sorted.length,
      sent_date: formatKst_(now, 'yyyy-MM-dd'),
    });
    return folder.createFile(pdf.setName((filePrefix || '') + name));
  } finally {
    copy.setTrashed(true);
  }
}

// 이름 붙은 범위(없으면 표시 글자만 있는 칸)에 직인·도장 이미지를 얹는다.
function placeSeal_(ss, sheet, rangeName, markText, fileId, label) {
  const cell = ss.getRangeByName(rangeName) || sheet.createTextFinder(markText).matchEntireCell(true).findNext();
  if (!cell) throw new Error(`템플릿에서 ${label} 자리('${rangeName}' 또는 '${markText}' 칸)를 찾을 수 없어요.`);
  const file = DriveApp.getFileById(fileId);
  if (!SHEET_IMAGE_TYPES.includes(file.getMimeType())) {
    throw new Error(`${label} 이미지는 PNG·JPG·GIF만 넣을 수 있어요. (지금 파일: ${file.getName()}, ${file.getMimeType()})`);
  }
  placeImage_(sheet, file.getBlob(), cell.getRow(), cell.getColumn(), SEAL_IMAGE_HEIGHT);
}

// 칸 가운데에 이미지를 얹는다. 높이를 맞추고 너비는 비율대로, 칸보다 넓으면 줄인다.
function placeImage_(sheet, blob, row, col, targetHeight) {
  const image = sheet.insertImage(blob, col, row);
  const ratio = image.getWidth() / image.getHeight();
  const cellWidth = sheet.getColumnWidth(col);
  const cellHeight = sheet.getRowHeight(row);
  let height = targetHeight;
  let width = Math.round(height * ratio);
  if (width > cellWidth - 4) {
    width = cellWidth - 4;
    height = Math.round(width / ratio);
  }
  image.setWidth(width).setHeight(height);
  image.setAnchorCellXOffset(Math.max(0, Math.round((cellWidth - width) / 2)));
  image.setAnchorCellYOffset(Math.max(0, Math.round((cellHeight - height) / 2)));
}

function exportSheetPdf_(spreadsheetId, sheetId) {
  const params = [
    'format=pdf', 'size=A4', 'portrait=true', 'fitw=true', 'gridlines=false',
    'printtitle=false', 'sheetnames=false', 'pagenum=UNDEFINED', 'fzr=false',
    'top_margin=0.5', 'bottom_margin=0.5', 'left_margin=0.4', 'right_margin=0.4',
    'horizontal_alignment=CENTER', `gid=${sheetId}`,
  ].join('&');
  const response = UrlFetchApp.fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params}`, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error(`PDF 내보내기 실패 (HTTP ${response.getResponseCode()})`);
  return response.getBlob().setContentType('application/pdf');
}

// '2026-11-03' → '11/3'
function shortDate_(yyyyMMdd) {
  const [, m, d] = String(yyyyMMdd).split('-');
  return `${Number(m)}/${Number(d)}`;
}

// '{org}_{end}' 같은 템플릿의 {이름}을 값으로 바꾼다. (메일 제목·본문, 파일명 공용)
function fillTemplate_(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key])));
}

function sendPdfToTelegram_(file, caption) {
  telegramApi_('sendDocument', { chat_id: requireConfig_(['TELEGRAM_CHAT_ID']).TELEGRAM_CHAT_ID, caption, document: file.getBlob() }, true);
}
