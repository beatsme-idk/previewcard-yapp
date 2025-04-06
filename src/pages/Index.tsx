import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import StepWizard from '@/components/StepWizard';
import FileUpload from '@/components/FileUpload';
import PreviewCard from '@/components/PreviewCard';
import JsonEditor from '@/components/JsonEditor';
import WalletConnect from '@/components/WalletConnect';
import { ImageFile, PreviewData, Step, FolderPath } from '@/lib/types';
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from '@/components/ui/use-toast';

const steps: Step[] = [
  {
    id: 'upload',
    title: 'Upload Files',
    description: 'Add URLs for the required asset files for your preview card.'
  },
  {
    id: 'preview',
    title: 'Preview',
    description: 'Configure and preview your OG card.'
  },
  {
    id: 'update',
    title: 'Update ENS',
    description: 'Update your ENS record with the preview URL.'
  }
];

const Index = () => {
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath | null>(null);

  // Update preview data when files or folder path changes
  useEffect(() => {
    if (files.length > 0) {
      const filesData = {
        inner: files.find(f => f.name === 'inner')?.preview || null,
        outer: files.find(f => f.name === 'outer')?.preview || null,
        overlay: files.find(f => f.name === 'overlay')?.preview || null,
      };
      
      setPreviewData({
        baseUrl: folderPath 
          ? `https://cdn.jsdelivr.net/gh/${folderPath.username}/${folderPath.repo}/og/${folderPath.folder}`
          : '',
        files: filesData
      });
    }
  }, [files, folderPath]);

  const handleFilesChange = (newFiles: ImageFile[]) => {
    setFiles(newFiles);
  };

  const handleFolderPathChange = (path: FolderPath) => {
    setFolderPath(path);
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      // Validate current step before proceeding
      if (activeStep === 0) {
        const requiredImages = ['inner', 'outer', 'overlay'];
        const missingImages = requiredImages.filter(name => 
          !files.some(f => f.name === name && f.preview)
        );
        
        if (missingImages.length > 0) {
          toast({
            title: "Missing images",
            description: `Please add URLs for all required images: ${missingImages.join(', ')}.png`,
            variant: "destructive"
          });
          return;
        }
      }
      
      if (activeStep === 1 && (!folderPath || !folderPath.username || !folderPath.repo)) {
        toast({
          title: "Missing repository information",
          description: "Please enter GitHub username and repository name.",
          variant: "destructive"
        });
        return;
      }
      
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return <FileUpload onFilesChange={handleFilesChange} />;
      case 1:
        return <PreviewCard 
          previewData={previewData} 
          onFolderPathChange={handleFolderPathChange} 
          files={files}
        />;
      case 2:
        return <JsonEditor previewData={previewData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="container py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold gradient-text">Preview Card Yapp</h1>
          <div className="flex items-center space-x-2">
            <WalletConnect />
          </div>
        </div>
      </header>
      
      <main className="container flex-1 py-8 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <StepWizard 
            steps={steps} 
            activeStep={activeStep} 
            onStepChange={setActiveStep} 
          />
          
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{steps[activeStep].title}</h2>
            <p className="text-muted-foreground">{steps[activeStep].description}</p>
          </div>
          
          <div className="animate-fade-in">
            {renderStepContent()}
          </div>
          
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={activeStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            
            <div className="flex space-x-2">
              <Button onClick={handleNext} className="gap-2" disabled={activeStep === steps.length - 1}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
              
              {activeStep === steps.length - 1 && (
                <Button onClick={() => setActiveStep(0)} className="gap-2">
                  Start Over
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t border-border py-4">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Preview Card Yapp - Customize your Yodl preview cards</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
