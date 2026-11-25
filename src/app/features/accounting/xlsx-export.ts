/** تصدير جدول بسيط إلى Excel (ExcelJS بيتحمّل عند الحاجة) */
export async function exportTableXlsx(
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  rtl: boolean,
  moneyCols: number[] = [],
): Promise<Blob> {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BENZED OS';
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ rightToLeft: rtl }] });
  ws.addRow(headers);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((c: any, i: number) => {
    c.width = i === 0 ? 34 : 20;
    if (moneyCols.includes(i)) c.numFmt = '#,##0.00';
  });
  const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
  void fileName;
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
