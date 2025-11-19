import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GeminiTableResponse {
    found: boolean;
    isContinuation: boolean;
    year: number | null;
    month: string | null;
    rows: Array<{
        Marca: string;
        Columns: Array<{
            Header: string;
            Value: string | number;
        }>;
    }>;
}

export interface FlatTableResponse {
    found: boolean;
    isContinuation: boolean;
    year: number | null;
    month: string | null;
    rows: Array<{
        Marca: string;
        [key: string]: string | number | undefined;
    }>;
}

export const analyzePdfPage = async (imageBase64: string, mode: ExtractionMode): Promise<FlatTableResponse> => {
    const modelId = "gemini-3-pro-preview"; 

    let specificInstructions = "";

    if (mode === ExtractionMode.SALES_ONLY) {
        specificInstructions = `
        CRÍTICO - MODO EXACTO:
        1. Estás buscando una tabla que tenga el título visible que contenga exactamente la frase: "VENTAS A PÚBLICO POR MARCA".
        2. Si la imagen NO tiene este título específico, devuelve { "found": false }.
        3. Si la página es una "continuación" de esta misma tabla (generalmente tiene encabezados similares pero sin el título principal grande), y parece ser parte de los datos de "VENTAS A PÚBLICO POR MARCA", extráela.
        `;
    } else {
        specificInstructions = `
        MODO GENERAL:
        1. Busca cualquier tabla principal de ventas automotrices en la imagen.
        2. Si hay múltiples, prioriza la más detallada.
        `;
    }

    const prompt = `
    Actúa como un extractor de datos experto. Analiza la imagen de la tabla de ventas automotrices.
    
    ${specificInstructions}
    
    OBJETIVO: Extraer TODOS los datos numéricos de la tabla asociados a cada Marca.
    
    INSTRUCCIONES DE EXTRACCIÓN DE COLUMNAS:
    1. Las tablas suelen tener encabezados jerárquicos (ej: "SUV" -> "Unidades", "Pasajeros" -> "Participación").
    2. DEBES combinar los encabezados para crear nombres de columna únicos. 
       Ejemplo: Si la columna "Uni" está bajo "Vehículo de Pasajeros", el nombre debe ser "Pasajeros - Uni".
       Ejemplo: "SUV - Rank", "Total - %", "Comercial - Und".
    3. Extrae TODAS las columnas numéricas y de rango visibles. No omitas ninguna.
    
    REGLAS GENERALES:
    1. BUSCAR MARCA: La primera columna suele ser la Marca (TOYOTA, KIA, etc.).
    2. FILTRAR: Ignora filas que sean sumas totales del mercado (como "TOTAL DEL MERCADO" al final). Sin embargo, SI extrae la columna "TOTAL" que pertenece a una fila de marca específica.
    3. FECHA: Busca "ENERO 2025", "FEBRERO 2024", etc. en el título.
    4. CONTINUACIÓN: Si el título dice "Parte 2" o "Continuación", marca isContinuation: true.

    FORMATO DE SALIDA:
    Devuelve un JSON donde cada fila tiene la "Marca" y una lista de "Columns" (Header y Value).
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageBase64
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        found: { type: Type.BOOLEAN },
                        isContinuation: { type: Type.BOOLEAN },
                        year: { type: Type.INTEGER },
                        month: { type: Type.STRING },
                        rows: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    Marca: { type: Type.STRING },
                                    Columns: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                Header: { type: Type.STRING, description: "Nombre combinado de la columna (ej: SUV - Uni)" },
                                                Value: { type: Type.STRING, description: "El valor tal cual aparece (ej: 1.230 o 5,4%)" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return { found: false, isContinuation: false, year: null, month: null, rows: [] };
        
        const result = JSON.parse(text) as GeminiTableResponse;

        // Flatten the structure for the app
        const flatRows = result.rows?.map(r => {
            const rowObj: any = { Marca: r.Marca };
            if (r.Columns) {
                r.Columns.forEach(c => {
                    // Basic cleanup of header names to be CSV friendly
                    const safeHeader = c.Header.trim();
                    rowObj[safeHeader] = c.Value;
                });
            }
            return rowObj;
        }) || [];

        return {
            found: result.found,
            isContinuation: result.isContinuation,
            year: result.year,
            month: result.month,
            rows: flatRows
        };

    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return { found: false, isContinuation: false, year: null, month: null, rows: [] };
    }
};