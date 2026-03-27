import type { ToolHandler } from './registry.js';
import { readFileSync } from 'node:fs';

/**
 * analyze_pdf - Extract text from PDF files
 */
export const analyzePdfTool: ToolHandler = {
  definition: {
    name: 'analyze_pdf',
    description:
      'Extract text content from a PDF file. Returns text organized by pages.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
      },
      required: ['path'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = String(input['path'] ?? '');
    if (!filePath) return 'Error: path is required';

    try {
      const buffer = readFileSync(filePath);
      const pdfParse = (await import('pdf-parse')).default as (
        buf: Buffer,
      ) => Promise<{
        numpages: number;
        info: Record<string, unknown>;
        text: string;
      }>;
      const data = await pdfParse(buffer);

      const summary = [
        `PDF Analysis: ${filePath}`,
        `Pages: ${data.numpages}`,
        `Info: ${JSON.stringify(data.info ?? {}, null, 2)}`,
        `---`,
        data.text.slice(0, 10000),
      ];

      if (data.text.length > 10000) {
        summary.push(
          `\n... (truncated, total ${data.text.length} characters)`,
        );
      }

      return summary.join('\n');
    } catch (err) {
      return `Error analyzing PDF: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/**
 * analyze_csv - Parse and analyze CSV files
 */
export const analyzeCsvTool: ToolHandler = {
  definition: {
    name: 'analyze_csv',
    description:
      'Parse a CSV file and return structured data summary including column names, row count, and sample rows.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the CSV file',
        },
        delimiter: {
          type: 'string',
          description: 'Column delimiter (default: auto-detect)',
        },
      },
      required: ['path'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = String(input['path'] ?? '');
    if (!filePath) return 'Error: path is required';

    try {
      const content = readFileSync(filePath, 'utf-8');
      const Papa = (await import('papaparse')).default;

      const parsed = Papa.parse<Record<string, unknown>>(content, {
        header: true,
        delimiter: (input['delimiter'] as string | undefined) ?? undefined,
        preview: 100,
        skipEmptyLines: true,
      });

      const totalLines = content.split('\n').length - 1;
      const columns = parsed.meta.fields ?? [];
      const rows = parsed.data;
      const sampleRows = rows.slice(0, 5);

      const summary = [
        `CSV Analysis: ${filePath}`,
        `Rows: ~${totalLines} | Columns: ${columns.length}`,
        `Delimiter: "${parsed.meta.delimiter}"`,
        ``,
        `Columns: ${columns.join(', ')}`,
        ``,
        `Sample data (first 5 rows):`,
        JSON.stringify(sampleRows, null, 2),
      ];

      if (parsed.errors.length > 0) {
        summary.push(`\nParse warnings: ${parsed.errors.length}`);
        for (const err of parsed.errors.slice(0, 3)) {
          summary.push(`  Row ${err.row}: ${err.message}`);
        }
      }

      return summary.join('\n');
    } catch (err) {
      return `Error analyzing CSV: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/**
 * analyze_excel - Parse Excel spreadsheets
 */
export const analyzeExcelTool: ToolHandler = {
  definition: {
    name: 'analyze_excel',
    description:
      'Parse an Excel file (.xlsx/.xls) and return a summary of each sheet with column names, row counts, and sample data.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the Excel file',
        },
        sheet: {
          type: 'string',
          description:
            'Specific sheet name to analyze (optional, analyzes all by default)',
        },
      },
      required: ['path'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = String(input['path'] ?? '');
    if (!filePath) return 'Error: path is required';

    try {
      const buffer = readFileSync(filePath);
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const targetSheet = input['sheet'] as string | undefined;
      const sheetNames = targetSheet
        ? [targetSheet].filter((s) => workbook.SheetNames.includes(s))
        : workbook.SheetNames;

      if (sheetNames.length === 0) {
        return `Error: Sheet "${targetSheet}" not found. Available: ${workbook.SheetNames.join(', ')}`;
      }

      const sections: string[] = [
        `Excel Analysis: ${filePath}`,
        `Sheets: ${workbook.SheetNames.join(', ')}`,
        '',
      ];

      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet) continue;
        const data = XLSX.utils.sheet_to_json(sheet) as Record<
          string,
          unknown
        >[];
        const columns =
          data.length > 0 ? Object.keys(data[0] as object) : [];

        sections.push(`## Sheet: ${name}`);
        sections.push(`Rows: ${data.length} | Columns: ${columns.length}`);
        sections.push(`Columns: ${columns.join(', ')}`);

        if (data.length > 0) {
          sections.push(`Sample (first 3 rows):`);
          sections.push(JSON.stringify(data.slice(0, 3), null, 2));
        }
        sections.push('');
      }

      return sections.join('\n');
    } catch (err) {
      return `Error analyzing Excel: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
