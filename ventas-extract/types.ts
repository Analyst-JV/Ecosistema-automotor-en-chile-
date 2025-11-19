export interface ExtractedRow {
    Marca: string;
    [key: string]: string | number | undefined;
}

export interface ProcessedTable {
    id: string;
    originalFileName: string;
    year: number;
    month: string; // Spanish month name
    formattedDate: string; // YYYY-MM format for the first CSV column
    rows: ExtractedRow[];
    isPart2: boolean;
    pageNumber: number;
}

export interface ProcessingStatus {
    fileName: string;
    currentStep: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    totalPages?: number;
    pagesProcessed?: number;
}

export enum AppView {
    UPLOAD = 'UPLOAD',
    DASHBOARD = 'DASHBOARD',
    DATA = 'DATA'
}

export enum ExtractionMode {
    ALL = 'ALL',
    SALES_ONLY = 'SALES_ONLY'
}