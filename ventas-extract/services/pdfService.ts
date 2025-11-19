import * as pdfjsLib from 'pdfjs-dist';

// Initialize worker
// Using esm.sh to match the import map provider.
// PDF.js v5+ is ESM only and uses .mjs for the worker file.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export const convertPdfPageToImage = async (file: File, pageNumber: number): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    if (pageNumber > pdf.numPages) {
        throw new Error("Page number out of bounds");
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 }); // 2.0 scale for better OCR quality
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error("Could not get canvas context");

    // Fix: Cast render context to any to resolve type mismatch with RenderParameters
    await page.render({
        canvasContext: context,
        viewport: viewport
    } as any).promise;

    // Convert to base64 string (remove data:image/png;base64, prefix for Gemini)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return dataUrl.split(',')[1];
};

export const getPdfPageCount = async (file: File): Promise<number> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
};

export const findPageWithText = async (file: File, searchText: string, startFrom: number = 1): Promise<number | null> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Normalize search text: remove spaces, lowercase (e.g. "VENTAS A PÚBLICO" -> "ventasapúblico")
    // This helps avoid issues with PDF spacing/layout
    const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, '');

    // Ensure we start from at least page 1
    const actualStart = Math.max(1, startFrom);

    for (let i = actualStart; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Concatenate all text items in the page
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join('')
            .toLowerCase()
            .replace(/\s+/g, '');

        if (pageText.includes(normalizedSearch)) {
            return i;
        }
    }

    return null;
};