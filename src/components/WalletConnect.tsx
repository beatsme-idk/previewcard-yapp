
import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Wallet } from "lucide-react";

const WalletConnect: React.FC = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Your Wallet</DialogTitle>
          <DialogDescription>
            Connect your wallet to interact with ENS and other blockchain services.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Wallet integration is coming soon. This feature will allow you to:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            <li>Directly connect to JustaName</li>
            <li>Update ENS records automatically</li>
            <li>Verify ownership of your domains</li>
          </ul>
          <Button disabled className="mt-2">Coming Soon</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletConnect;
