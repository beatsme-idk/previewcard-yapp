import { ethers } from 'ethers';
import { ENSRecord } from './types';

// Add window.__walletProviders type declaration
declare global {
  interface Window {
    __walletProviders: {
      ethereum?: any;
      updateProvider?: (provider: any) => void;
    };
  }
}

export const ENS_RESOLVER_ABI = [
  'function setText(bytes32 node, string key, string value) external',
  'function text(bytes32 node, string key) external view returns (string)',
];

export class ENSService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  
  constructor(ethereumProvider?: any) {
    try {
      if (ethereumProvider) {
        // Use the provided ethereum provider
        this.provider = new ethers.BrowserProvider(ethereumProvider);
      } else if (typeof window !== 'undefined') {
        // Try to get provider from our custom container first
        if (window.__walletProviders?.ethereum) {
          this.provider = new ethers.BrowserProvider(window.__walletProviders.ethereum);
        } 
        // As a fallback, try window.ethereum but with try/catch
        else {
          try {
            const ethereum = window.ethereum;
            if (ethereum) {
              this.provider = new ethers.BrowserProvider(ethereum);
              // Store for future reference
              if (window.__walletProviders) {
                window.__walletProviders.ethereum = ethereum;
              }
            } else {
              console.warn('No ethereum provider available');
            }
          } catch (e) {
            console.warn('Error accessing ethereum provider:', e);
          }
        }
      } else {
        console.warn('No ethereum provider available');
      }
    } catch (error) {
      console.error('Error initializing provider:', error);
    }
  }
  
  // Method to update the provider if it becomes available later
  updateProvider(ethereumProvider: any) {
    if (ethereumProvider) {
      try {
        this.provider = new ethers.BrowserProvider(ethereumProvider);
        // Reset signer since provider changed
        this.signer = null;
        return true;
      } catch (error) {
        console.error('Error updating provider:', error);
        return false;
      }
    }
    return false;
  }
  
  async connectSigner() {
    if (!this.provider) {
      console.error('No provider available');
      return false;
    }
    
    try {
      this.signer = await this.provider.getSigner();
      return true;
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      return false;
    }
  }
  
  async getENSNameForAddress(address: string): Promise<string | null> {
    if (!this.provider) {
      console.warn('No provider available');
      return null;
    }
    
    try {
      const ensName = await this.provider.lookupAddress(address);
      return ensName;
    } catch (error) {
      console.error('Error getting ENS name:', error);
      return null;
    }
  }
  
  async getTextRecord(ensName: string, key: string = 'me.yodl'): Promise<string | null> {
    if (!this.provider) {
      console.warn('No provider available');
      return null;
    }
    
    try {
      // Get node hash for the ENS name
      const nodeHash = ethers.namehash(ensName);
      
      // Get resolver address for the ENS name
      const resolver = await this.provider.getResolver(ensName);
      
      if (!resolver) {
        console.error('No resolver found for ENS name:', ensName);
        return null;
      }
      
      // Create resolver contract instance
      const resolverContract = new ethers.Contract(
        resolver.address,
        ENS_RESOLVER_ABI,
        this.provider
      );
      
      // Call text function to get the record
      const textRecord = await resolverContract.text(nodeHash, key);
      return textRecord;
    } catch (error) {
      console.error('Error getting text record:', error);
      return null;
    }
  }
  
  async setTextRecord(ensName: string, key: string, value: string): Promise<boolean> {
    if (!this.provider || !this.signer) {
      console.error('No provider or signer available');
      return false;
    }
    
    try {
      // Get node hash for the ENS name
      const nodeHash = ethers.namehash(ensName);
      
      // Get resolver address for the ENS name
      const resolver = await this.provider.getResolver(ensName);
      
      if (!resolver) {
        console.error('No resolver found for ENS name:', ensName);
        return false;
      }
      
      // Create resolver contract instance with signer
      const resolverContract = new ethers.Contract(
        resolver.address,
        ENS_RESOLVER_ABI,
        this.signer
      );
      
      // Call setText function to update the record
      const tx = await resolverContract.setText(nodeHash, key, value);
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error setting text record:', error);
      return false;
    }
  }
  
  async updateOgCardRecord(ensName: string, record: ENSRecord): Promise<boolean> {
    if (!this.provider) {
      console.warn('No provider available');
      return false;
    }
    
    try {
      // Get existing record if any
      const existingRecordStr = await this.getTextRecord(ensName, 'me.yodl');
      let existingRecord: ENSRecord = {};
      
      if (existingRecordStr) {
        try {
          existingRecord = JSON.parse(existingRecordStr);
        } catch (e) {
          console.warn('Invalid existing record format:', existingRecordStr);
        }
      }
      
      // Merge existing record with new og card data
      const updatedRecord = {
        ...existingRecord,
        og: record.og
      };
      
      // Update the ENS record
      const success = await this.setTextRecord(
        ensName,
        'me.yodl',
        JSON.stringify(updatedRecord)
      );
      
      return success;
    } catch (error) {
      console.error('Error updating OG card record:', error);
      return false;
    }
  }
} 