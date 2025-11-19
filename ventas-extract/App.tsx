import React, { useState, useCallback } from 'react';
import { FileUploader } from './components/FileUploader';
import { HeatMapMatrix } from './components/HeatMapMatrix';
import { convertPdfPageToImage, getPdfPageCount, findPageWithText } from './services/pdfService';
import { analyzePdfPage } from './services/geminiService';
import { AppView, ProcessedTable, ProcessingStatus, ExtractionMode } from './types';
import { 
    LayoutDashboard, 
    Upload, 
    Table as TableIcon, 
    Play, 
    Download, 
    Loader2, 
    CheckCircle, 
    AlertCircle,
    FileText,
    Filter,
    Target,
    Search
} from 'lucide-react';

export default function App() {
    const [view, setView] = useState<AppView>(AppView.UPLOAD);
    const [files, setFiles] = useState<File[]>([]);
    const [processedTables, setProcessedTables] = useState<ProcessedTable[]>([]);
    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractionMode, setExtractionMode] = useState<ExtractionMode>(ExtractionMode.SALES_ONLY);

    const handleFilesSelected = (selectedFiles: File[]) => {
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const processFiles = async () => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setView(AppView.DATA);

        // Initial status
        setProcessingStatus(files.map(f => ({
            fileName: f.name,
            status: 'pending',
            currentStep: 'Esperando...'
        })));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            let startPage = 1;
            
            // Update status to processing
            setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing', currentStep: 'Iniciando...' } : s));

            try {
                const numPages = await getPdfPageCount(file);
                
                // --- FAST SCAN LOGIC (Only for SALES_ONLY mode) ---
                if (extractionMode === ExtractionMode.SALES_ONLY) {
                    setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, currentStep: 'Escaneo rápido de texto (desde Pág 4)...' } : s));
                    
                    // Look for the specific header strictly, starting from page 4 to skip covers/index
                    const foundPage = await findPageWithText(file, "VENTAS A PÚBLICO POR MARCA", 4);
                    
                    if (!foundPage) {
                        console.log(`Texto 'VENTAS A PÚBLICO POR MARCA' no encontrado en ${file.name} (buscando desde pág 4). Saltando archivo.`);
                        setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed', currentStep: 'Sin tabla de Ventas' } : s));
                        continue; // Skip to next file
                    }

                    startPage = foundPage;
                    console.log(`Texto encontrado en página ${startPage} de ${file.name}. Iniciando análisis visual.`);
                }
                // --------------------------------------------------

                let foundSequence = false;
                
                for (let pageNum = startPage; pageNum <= numPages; pageNum++) {
                    // Update page progress
                    setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, currentStep: `Analizando visualmente Pág ${pageNum}/${numPages}` } : s));

                    // Convert page to image
                    const imageBase64 = await convertPdfPageToImage(file, pageNum);
                    
                    // Analyze with Gemini using selected mode
                    const result = await analyzePdfPage(imageBase64, extractionMode);

                    if (result.found) {
                        foundSequence = true;
                        
                        const newTable: ProcessedTable = {
                            id: `${file.name}_p${pageNum}_${Date.now()}`,
                            originalFileName: file.name,
                            year: result.year || new Date().getFullYear(),
                            month: result.month || 'Desconocido',
                            formattedDate: `${result.month} ${result.year}`,
                            rows: result.rows, // Already flattened in service
                            isPart2: result.isContinuation,
                            pageNumber: pageNum
                        };

                        setProcessedTables(prev => [...prev, newTable]);
                    } else {
                        // Optimization Logic:
                        // If we were finding the table sequence and now we stopped finding it
                        // (or if we are in SALES_ONLY mode and the first checked page -startPage- failed visually)
                        if (foundSequence) {
                            console.log(`Terminando análisis de ${file.name} en página ${pageNum} (Secuencia terminada)`);
                            break; 
                        }

                        // Extra check: If we scanned via text and found the page, but Gemini didn't see the table, 
                        // we might want to check 1 more page just in case, but usually we should break to save tokens
                        // if strict mode is on.
                        if (extractionMode === ExtractionMode.SALES_ONLY && pageNum > startPage + 2) {
                             // Safety break if we've gone 2 pages past the detected start without finding/continuing
                             break;
                        }
                    }
                }

                setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed', currentStep: 'Completado' } : s));

            } catch (err) {
                console.error(err);
                setProcessingStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error', currentStep: 'Error en procesamiento' } : s));
            }
        }

        setIsProcessing(false);
    };

    const downloadCsv = (table: ProcessedTable) => {
        if (table.rows.length === 0) return;

        // Get all unique keys from all rows to form headers, ensuring Date is first and Marca is second
        const allKeys = Array.from(new Set(table.rows.flatMap(Object.keys)));
        const valueKeys = allKeys.filter(k => k !== 'Marca');
        const headers = ['Fecha', 'Marca', ...valueKeys];

        const csvContent = [
            headers.join(','), // Header row
            ...table.rows.map(row => {
                return headers.map(header => {
                    if (header === 'Fecha') return `"${table.formattedDate}"`;
                    const val = row[header] ?? '';
                    return `"${val}"`;
                }).join(',');
            })
        ].join('\n');

        // Add BOM for Excel UTF-8 compatibility
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        const suffix = table.isPart2 ? '_part2' : '';
        // Remove .pdf extension if present
        const cleanName = table.originalFileName.replace(/\.pdf$/i, '');
        link.href = URL.createObjectURL(blob);
        link.download = `${cleanName}${suffix}.csv`;
        link.click();
    };

    const downloadAll = () => {
        processedTables.forEach(table => downloadCsv(table));
    };

    return (
        <div className="min-h-screen flex bg-notion-gray font-sans text-notion-text">
            {/* Sidebar */}
            <aside className="w-64 bg-notion-bg border-r border-notion-border p-4 flex flex-col">
                <div className="mb-8 flex items-center gap-2 px-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-vivid-primary to-vivid-secondary rounded-lg shadow-sm"></div>
                    <h1 className="font-bold text-lg tracking-tight">Ventas<span className="text-vivid-primary">Extract</span></h1>
                </div>

                <nav className="space-y-1 flex-1">
                    <button 
                        onClick={() => setView(AppView.UPLOAD)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === AppView.UPLOAD ? 'bg-vivid-primary/10 text-vivid-primary' : 'hover:bg-notion-gray text-notion-text'}`}
                    >
                        <Upload size={18} />
                        Subir Archivos
                    </button>
                    <button 
                        onClick={() => setView(AppView.DASHBOARD)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === AppView.DASHBOARD ? 'bg-vivid-primary/10 text-vivid-primary' : 'hover:bg-notion-gray text-notion-text'}`}
                    >
                        <LayoutDashboard size={18} />
                        Gráficos
                    </button>
                    <button 
                        onClick={() => setView(AppView.DATA)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${view === AppView.DATA ? 'bg-vivid-primary/10 text-vivid-primary' : 'hover:bg-notion-gray text-notion-text'}`}
                    >
                        <TableIcon size={18} />
                        Datos Extraídos
                    </button>
                </nav>

                <div className="mt-auto pt-4">
                    {files.length > 0 && (
                        <div className="pb-6 space-y-4">
                            
                            {/* Mode Selector */}
                            <div className="px-1">
                                <p className="text-xs font-semibold text-notion-muted mb-2 uppercase tracking-wider">Modo de Extracción</p>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setExtractionMode(ExtractionMode.SALES_ONLY)}
                                        disabled={isProcessing}
                                        className={`flex items-start gap-2 p-2 rounded border text-left transition-all ${
                                            extractionMode === ExtractionMode.SALES_ONLY 
                                            ? 'bg-vivid-accent/10 border-vivid-accent text-vivid-accent' 
                                            : 'bg-white border-notion-border text-notion-muted hover:border-vivid-accent/50'
                                        }`}
                                    >
                                        <Search size={16} className="mt-0.5 shrink-0" />
                                        <div>
                                            <span className="block text-xs font-bold">Solo Ventas Público</span>
                                            <span className="block text-[10px] opacity-80">Escaneo de texto rápido + IA precisa</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setExtractionMode(ExtractionMode.ALL)}
                                        disabled={isProcessing}
                                        className={`flex items-start gap-2 p-2 rounded border text-left transition-all ${
                                            extractionMode === ExtractionMode.ALL 
                                            ? 'bg-vivid-primary/10 border-vivid-primary text-vivid-primary' 
                                            : 'bg-white border-notion-border text-notion-muted hover:border-vivid-primary/50'
                                        }`}
                                    >
                                        <Filter size={16} className="mt-0.5 shrink-0" />
                                        <div>
                                            <span className="block text-xs font-bold">Todas las Tablas</span>
                                            <span className="block text-[10px] opacity-80">Extrae cualquier tabla de ventas.</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-notion-muted mb-2">ARCHIVOS ({files.length})</div>
                                <button 
                                    onClick={processFiles}
                                    disabled={isProcessing}
                                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-md text-white font-medium shadow-sm transition-all ${isProcessing ? 'bg-notion-muted cursor-not-allowed' : 'bg-vivid-accent hover:bg-emerald-600'}`}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                                    {isProcessing ? 'Procesando...' : 'Procesar Todo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Author Section */}
                    <div className="pt-4 border-t border-notion-border text-center px-1">
                        <p className="text-xs font-medium text-notion-text mb-2">
                            Author: <span className="font-bold">Jahair Valenzuela</span>
                        </p>
                        <div className="bg-notion-gray/50 rounded-lg p-3 border border-notion-border hover:bg-white transition-colors duration-300">
                            <p className="text-[10px] font-bold text-vivid-primary tracking-wider mb-2 uppercase">
                                PENSAMIENTO ESTRATÉGICO 🧠
                            </p>
                            <p className="text-xs font-semibold text-notion-text mb-2 leading-snug">
                                Análisis de datos 📊 + IA 🤖 <br/>
                                = RESULTADO EXITOSO 🚀
                            </p>
                            <p className="text-[10px] text-notion-muted leading-relaxed">
                                Tecnología con visión de negocios.<br/>
                                Datos con propósito.
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                
                {view === AppView.UPLOAD && (
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold mb-2">Importar Datos</h2>
                        <p className="text-notion-muted mb-8">Sube tus reportes en PDF para extraer las tablas de ventas automáticamente.</p>
                        
                        <FileUploader onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

                        {files.length > 0 && (
                            <div className="mt-8 bg-white rounded-xl border border-notion-border p-6 shadow-sm">
                                <h3 className="font-semibold mb-4 flex items-center gap-2">
                                    <FileText size={18} className="text-notion-muted"/> 
                                    Cola de Procesamiento
                                </h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {files.map((f, idx) => {
                                        const status = processingStatus[idx];
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-notion-gray rounded-md border border-notion-border text-sm">
                                                <span className="truncate max-w-[300px]">{f.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-notion-muted text-xs">
                                                        {status ? status.currentStep : 'Pendiente'}
                                                    </span>
                                                    {status?.status === 'processing' && <Loader2 size={16} className="animate-spin text-vivid-primary"/>}
                                                    {status?.status === 'completed' && <CheckCircle size={16} className="text-vivid-accent"/>}
                                                    {status?.status === 'error' && <AlertCircle size={16} className="text-vivid-secondary"/>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {view === AppView.DASHBOARD && (
                    <div className="max-w-5xl mx-auto">
                         <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
                         <p className="text-notion-muted mb-8">Visualización de densidad de datos por año y mes.</p>
                         
                         <div className="bg-white p-6 rounded-xl border border-notion-border shadow-sm">
                            <HeatMapMatrix tables={processedTables} />
                         </div>
                    </div>
                )}

                {view === AppView.DATA && (
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-3xl font-bold">Datos Extraídos</h2>
                                <p className="text-notion-muted">Revisa y exporta tus tablas.</p>
                            </div>
                            {processedTables.length > 0 && (
                                <button 
                                    onClick={downloadAll}
                                    className="flex items-center gap-2 px-4 py-2 bg-notion-text text-white rounded-md hover:bg-black transition-colors text-sm font-medium"
                                >
                                    <Download size={16} />
                                    Exportar Todo
                                </button>
                            )}
                        </div>

                        {processedTables.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-notion-border">
                                <p className="text-notion-muted">No hay datos procesados aún. Sube archivos y presiona Procesar.</p>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {processedTables.map((table) => {
                                    // Calculate dynamic headers from the first few rows to get a good representation
                                    // Filter out 'Marca' as we want to display it first explicitly
                                    const allKeys = Array.from(new Set(table.rows.flatMap(r => Object.keys(r))));
                                    const dynamicHeaders = (allKeys as string[]).filter(k => k !== 'Marca').sort();

                                    return (
                                        <div key={table.id} className="bg-white rounded-xl border border-notion-border shadow-sm overflow-hidden">
                                            <div className="p-4 border-b border-notion-border flex items-center justify-between bg-notion-gray/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white rounded border border-notion-border shadow-sm">
                                                        <TableIcon size={16} className="text-vivid-primary"/>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-sm">{table.originalFileName}</h4>
                                                        <p className="text-xs text-notion-muted">
                                                            {table.formattedDate} {table.isPart2 ? '(Parte 2 / Continuación)' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => downloadCsv(table)}
                                                    className="text-xs font-medium text-notion-muted hover:text-vivid-primary flex items-center gap-1 px-2 py-1 rounded hover:bg-notion-gray"
                                                >
                                                    <Download size={14} /> CSV
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-notion-muted uppercase bg-notion-gray/50 border-b border-notion-border">
                                                        <tr>
                                                            <th className="px-4 py-3 font-medium sticky left-0 bg-notion-gray/50 z-10">Marca</th>
                                                            {dynamicHeaders.map(header => (
                                                                <th key={header} className="px-4 py-3 font-medium whitespace-nowrap">
                                                                    {header}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-notion-border">
                                                        {table.rows.slice(0, 8).map((row, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-notion-gray/20">
                                                                <td className="px-4 py-2 font-bold text-notion-text sticky left-0 bg-white border-r border-notion-border">{row.Marca}</td>
                                                                {dynamicHeaders.map(header => (
                                                                    <td key={header} className="px-4 py-2 text-right font-mono whitespace-nowrap text-xs">
                                                                        {row[header] ?? '-'}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                        {table.rows.length > 8 && (
                                                            <tr>
                                                                <td colSpan={dynamicHeaders.length + 1} className="px-4 py-2 text-center text-xs text-notion-muted italic bg-notion-gray/10">
                                                                    ... {table.rows.length - 8} filas más ...
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}