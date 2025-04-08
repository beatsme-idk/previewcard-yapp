import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Wallet, AlertCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

// Disable wallet connect and show a simple UI placeholder instead
const WalletConnect: React.FC = () => {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <div>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wallet Connections Temporarily Disabled</DialogTitle>
          <DialogDescription>
            Wallet connections are temporarily disabled in this version. Updates will be coming soon.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4 mr-2" />
            You can still use the app without connecting a wallet. The preview card URL generation will work without a wallet connection.
          </Alert>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletConnect;
