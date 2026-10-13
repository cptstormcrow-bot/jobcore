/**
 * Payroll export I/O layer. Takes the string a core formatter returns,
 * writes it to the cache directory as UTF-8 and opens the share sheet.
 * No Supabase, no React.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type PayrollExportFormat =
  | 'generic_csv'
  | 'qbo_journal_csv'
  | 'iif_journal'
  | 'iif_timeact';

function isIif(format: PayrollExportFormat): boolean {
  return format === 'iif_journal' || format === 'iif_timeact';
}

export function payrollExportFileName(
  format: PayrollExportFormat,
  periodStart: string,
  periodEnd: string,
): string {
  const ext = isIif(format) ? 'iif' : 'csv';
  return `payroll-${periodStart}_${periodEnd}-${format}.${ext}`;
}

export function payrollExportMimeType(format: PayrollExportFormat): string {
  return isIif(format) ? 'text/plain' : 'text/csv';
}

export async function writePayrollExport(
  fileName: string,
  content: string,
): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('cacheDirectory unavailable');
  const uri = dir + fileName;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

export async function sharePayrollExport(
  fileUri: string,
  format: PayrollExportFormat,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: payrollExportMimeType(format),
    dialogTitle: 'Export payroll',
    UTI: isIif(format) ? 'public.plain-text' : 'public.comma-separated-values-text',
  });
}

export async function writeAndSharePayrollExport(
  format: PayrollExportFormat,
  periodStart: string,
  periodEnd: string,
  content: string,
): Promise<string> {
  const uri = await writePayrollExport(
    payrollExportFileName(format, periodStart, periodEnd),
    content,
  );
  await sharePayrollExport(uri, format);
  return uri;
}
