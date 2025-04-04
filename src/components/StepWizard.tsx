
import React from 'react';
import { Button } from "@/components/ui/button";
import { Step } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

interface StepWizardProps {
  steps: Step[];
  activeStep: number;
  onStepChange: (step: number) => void;
}

const StepWizard: React.FC<StepWizardProps> = ({
  steps,
  activeStep,
  onStepChange,
}) => {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <Button
              variant={activeStep === index ? "default" : (index < activeStep ? "outline" : "ghost")}
              className={cn(
                "rounded-full w-10 h-10 p-0 flex items-center justify-center",
                activeStep === index && "bg-primary text-primary-foreground",
                index < activeStep && "text-primary border-primary"
              )}
              onClick={() => index <= activeStep && onStepChange(index)}
              disabled={index > activeStep}
            >
              {index < activeStep ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </Button>
            {index < steps.length - 1 && (
              <div 
                className={cn(
                  "h-1 flex-1 mx-2",
                  index < activeStep ? "bg-primary" : "bg-secondary"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {steps.map((step, index) => (
          <div
            key={`label-${step.id}`}
            className={cn(
              "text-center text-sm w-24 mx-auto",
              activeStep === index ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {step.title}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepWizard;
