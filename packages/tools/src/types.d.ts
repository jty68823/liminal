declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfData>;
  export default pdfParse;
}

declare module 'xlsx' {
  interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  interface WorkSheet {}
  function read(data: Buffer | ArrayBuffer | string, opts?: { type?: string }): WorkBook;
  const utils: {
    sheet_to_json<T = Record<string, unknown>>(worksheet: WorkSheet): T[];
  };
  export { read, utils, WorkBook, WorkSheet };
}
