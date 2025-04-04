
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageFile } from "@/lib/types";
import { UploadCloud, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface FileUploadProps {
  onFilesChange: (files: ImageFile[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange }) => {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [files, setFiles] = useState<ImageFile[]>([
    { name: 'inner', file: null, preview: null },
    { name: 'outer', file: null, preview: null },
    { name: 'overlay', file: null, preview: null },
  ]);

  const handleFileDrop = useCallback((name: 'inner' | 'outer' | 'overlay', file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload image files only.",
        variant: "destructive"
      });
      return;
    }

    // Create a preview URL
    const preview = URL.createObjectURL(file);
    
    // Update the state
    const updatedFiles = files.map(item => 
      item.name === name ? { ...item, file, preview } : item
    );
    
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
    
    // Validate image dimensions (can't do this until loaded)
    const img = new Image();
    img.onload = () => {
      // Add dimension validation logic here if needed
      URL.revokeObjectURL(img.src);
    };
    img.src = preview;
  }, [files, onFilesChange, toast]);

  const handleDragOver = useCallback((e: React.DragEvent, name: 'inner' | 'outer' | 'overlay') => {
    e.preventDefault();
    setDragOver(name);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, name: 'inner' | 'outer' | 'overlay') => {
    e.preventDefault();
    setDragOver(null);
    
    if (e.dataTransfer.files.length > 0) {
      handleFileDrop(name, e.dataTransfer.files[0]);
    }
  }, [handleFileDrop]);

  const removeFile = useCallback((name: 'inner' | 'outer' | 'overlay') => {
    const updatedFiles = files.map(item => 
      item.name === name ? { ...item, file: null, preview: null } : item
    );
    
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, name: 'inner' | 'outer' | 'overlay') => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileDrop(name, e.target.files[0]);
    }
  }, [handleFileDrop]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {files.map(({ name, file, preview }) => (
        <Card 
          key={name}
          className={cn(
            "border-2 transition-all duration-200 animate-fade-in",
            dragOver === name ? "border-primary border-dashed" : "border-border"
          )}
        >
          <CardContent className="p-4">
            <div className="text-center mb-3">
              <h3 className="text-lg font-semibold capitalize">{name}.png</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {file ? file.name : "Required"}
              </p>
            </div>

            {!file ? (
              <div
                className="h-40 flex flex-col items-center justify-center border border-dashed rounded-md p-4 cursor-pointer bg-secondary/30"
                onDragOver={(e) => handleDragOver(e, name)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, name)}
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-center text-muted-foreground mb-2">
                  Drag & drop or click to upload
                </p>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    Browse Files
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(e, name)}
                    />
                  </label>
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -top-2 -right-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 rounded-full p-0"
                    onClick={() => removeFile(name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-40 rounded-md overflow-hidden flex justify-center items-center bg-black/20">
                  <img 
                    src={preview || ''} 
                    alt={`${name} preview`}
                    className="max-h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-center mt-2 text-sm text-green-500">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  File uploaded
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FileUpload;
