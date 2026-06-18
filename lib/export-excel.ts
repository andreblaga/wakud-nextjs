/**
 * Shared client-side Excel export. exceljs is dynamically imported so it only
 * loads when a user actually exports (keeps it out of the initial bundle).
 *
 * Used from client components (Deals table, Finance invoices, …) so it can
 * export exactly the rows currently in view — i.e. respecting active filters.
 */

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export async function exportRowsToExcel<T>({
  filename,
  sheetName = "Sheet1",
  columns,
  rows,
}: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<void> {
  // exceljs ships both a default and named exports depending on bundler entry.
  const mod = (await import("exceljs")) as unknown as {
    Workbook?: new () => ExcelWorkbook;
    default?: { Workbook: new () => ExcelWorkbook };
  };
  const Workbook = mod.Workbook ?? mod.default?.Workbook;
  if (!Workbook) throw new Error("exceljs failed to load");

  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c, i) => ({
    header: c.header,
    key: String(i),
    width: Math.min(48, Math.max(12, c.header.length + 4)),
  }));

  for (const row of rows) {
    const record: Record<string, string | number | null> = {};
    columns.forEach((c, i) => {
      const v = c.value(row);
      record[String(i)] = v === undefined || v === null ? null : v;
    });
    ws.addRow(record);
  }
  ws.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Minimal structural type for the bits of exceljs we touch (avoids importing
// the heavy type surface eagerly).
type ExcelWorkbook = {
  addWorksheet: (name: string) => {
    columns: { header: string; key: string; width: number }[];
    addRow: (data: Record<string, string | number | null>) => unknown;
    getRow: (n: number) => { font: { bold: boolean } };
  };
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
};
