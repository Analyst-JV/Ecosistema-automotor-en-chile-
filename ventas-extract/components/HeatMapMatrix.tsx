import React, { useMemo } from 'react';
import { ProcessedTable } from '../types';

interface HeatMapMatrixProps {
    tables: ProcessedTable[];
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const HeatMapMatrix: React.FC<HeatMapMatrixProps> = ({ tables }) => {
    const matrixData = useMemo(() => {
        const map = new Map<string, number>();
        const yearsSet = new Set<number>();

        tables.forEach(t => {
            if (t.year && t.month) {
                yearsSet.add(t.year);
                
                // Normalize month name to index
                const monthLower = t.month.toLowerCase().trim();
                const mIndex = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthLower.substring(0, 3)));
                
                if (mIndex >= 0) {
                    const key = `${t.year}-${mIndex}`;
                    const current = map.get(key) || 0;
                    // Add number of rows to the density count
                    map.set(key, current + t.rows.length);
                }
            }
        });

        const years = Array.from(yearsSet).sort((a, b) => b - a);
        return { years, map };
    }, [tables]);

    const getIntensityClass = (count: number) => {
        if (count === 0) return 'bg-notion-gray';
        if (count < 10) return 'bg-vivid-primary/20';
        if (count < 50) return 'bg-vivid-primary/50';
        if (count < 100) return 'bg-vivid-primary/80';
        return 'bg-vivid-primary text-white';
    };

    if (tables.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-notion-muted">
                <p>No hay datos procesados para visualizar.</p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto pb-4">
            <h3 className="text-lg font-semibold mb-4 text-notion-text">Mapa de Calor: Densidad de Datos (Filas)</h3>
            
            <div className="min-w-[800px]">
                {/* Header Row (Months) */}
                <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1">
                    <div className="font-bold text-xs text-right pr-2 pt-2">AÑO</div>
                    {MONTHS.map((m) => (
                        <div key={m} className="text-xs font-medium text-center text-notion-muted uppercase truncate">
                            {m.substring(0, 3)}
                        </div>
                    ))}
                </div>

                {/* Data Rows */}
                {matrixData.years.map((year) => (
                    <div key={year} className="grid grid-cols-[80px_repeat(12,1fr)] gap-1 mb-1">
                        <div className="font-bold text-sm text-notion-text flex items-center justify-end pr-3">
                            {year}
                        </div>
                        {MONTHS.map((_, index) => {
                            const key = `${year}-${index}`;
                            const count = matrixData.map.get(key) || 0;
                            return (
                                <div 
                                    key={key}
                                    title={`${MONTHS[index]} ${year}: ${count} filas`}
                                    className={`h-10 rounded-md flex items-center justify-center text-xs font-semibold transition-all hover:scale-105 cursor-default ${getIntensityClass(count)}`}
                                >
                                    {count > 0 ? count : ''}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            
            <div className="mt-4 flex gap-4 text-xs text-notion-muted justify-end">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-notion-gray rounded"></div> 0</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-vivid-primary/20 rounded"></div> 1-10</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-vivid-primary/50 rounded"></div> 10-50</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-vivid-primary/80 rounded"></div> 50+</div>
            </div>
        </div>
    );
};
