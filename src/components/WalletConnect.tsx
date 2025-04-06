import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Wallet } from "lucide-react";
import { useAccount } from 'wagmi';

const WalletConnect: React.FC = () => {
  const { isConnected } = useAccount();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div>
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              if (!ready) {
                return (
                  <Button variant="outline" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                );
              }
              return (
                <div>
                  {!account && (
                    <Button variant="outline" className="gap-2" onClick={openConnectModal}>
                      <Wallet className="h-4 w-4" />
                      Connect Wallet
                    </Button>
                  )}
                  {account && (
                    <Button variant="outline" className="gap-2">
                      {chain?.name ?? 'Unknown'}
                      {account.displayName.substring(0, 6)}...
                      {account.displayName.substring(account.displayName.length - 4)}
                    </Button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </DialogTrigger>
      {!isConnected && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Your Wallet</DialogTitle>
            <DialogDescription>
              Connect your wallet to interact with ENS and other blockchain services.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <ConnectButton />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default WalletConnect;
