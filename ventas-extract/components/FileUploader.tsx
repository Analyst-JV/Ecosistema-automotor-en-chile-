import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploaderProps {
    onFilesSelected: (files: File[]) => void;
    isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isProcessing }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            onFilesSelected(Array.from(event.target.files));
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-xl border-2 border-dashed border-notion-border hover:border-vivid-primary transition-colors duration-300 group">
            <label className="flex flex-col items-center justify-center w-full h-48 cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="p-4 bg-vivid-primary/10 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Upload className="w-8 h-8 text-vivid-primary" />
                    </div>
                    <p className="mb-2 text-lg font-medium text-notion-text">
                        <span className="font-bold">Click para subir</span> o arrastra tus PDFs
                    </p>
                    <p className="text-sm text-notion-muted">
                        Sube una carpeta o múltiples archivos PDF
                    </p>
                </div>
                <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="application/pdf"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                />
            </label>
        </div>
    );
};