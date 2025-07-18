import { ethers } from 'ethers';
import { useGasStore } from '../store/gasStore';

// Using the API key you provided.
const YOUR_INFURA_KEY = "19fb1db338734131b56ab8f56b7420ee";

const RPC_ENDPOINTS = {
  ethereum: `wss://mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
  polygon: `wss://polygon-mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
  arbitrum: `wss://arbitrum-mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
};

const UNISWAP_V3_POOL_ADDRESS = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
const UNISWAP_V3_POOL_ABI = ['event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'];

export const CHAIN_DETAILS = {
  ethereum: { name: 'Ethereum', symbol: 'ETH', color: '#627EEA' },
  polygon: { name: 'Polygon', symbol: 'MATIC', color: '#8247E5' },
  arbitrum: { name: 'Arbitrum', symbol: 'ETH', color: '#28A0F0' },
};

export const GAS_LIMIT_STANDARD_TX = 21000;

const web3Service = {
  providers: {},
  isInitialized: false,
  connectionTimeouts: {},
  
  initProviders: () => {
    // Prevent multiple initializations
    if (web3Service.isInitialized) {
      return;
    }
    
    const { updateGasPrice, setChainStatus } = useGasStore.getState();

    Object.keys(RPC_ENDPOINTS).forEach(chain => {
      try {
        // Add a small delay to prevent rapid connection attempts
        web3Service.connectionTimeouts[chain] = setTimeout(() => {
          web3Service.connectToChain(chain, updateGasPrice, setChainStatus);
        }, Math.random() * 1000); // Random delay up to 1 second
      } catch (error) {
        console.error(`Failed to schedule connection to ${chain}:`, error);
        setChainStatus(chain, 'error');
      }
    });
    
    web3Service.isInitialized = true;
  },

  connectToChain: async (chain, updateGasPrice, setChainStatus) => {
    try {
      // Check if provider already exists and is connected
      if (web3Service.providers[chain]) {
        return;
      }

      const provider = new ethers.WebSocketProvider(RPC_ENDPOINTS[chain]);
      web3Service.providers[chain] = provider;

      // Add connection state tracking
      let isConnected = false;
      let connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout for ${chain}`));
        }, 10000); // 10 second timeout

        if (provider._websocket) {
          provider._websocket.on('open', () => {
            clearTimeout(timeout);
            isConnected = true;
            setChainStatus(chain, 'connected');
            resolve();
          });
          
          provider._websocket.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`${chain} WebSocket error:`, err);
            setChainStatus(chain, 'error');
            reject(err);
          });
          
          provider._websocket.on('close', () => {
            if (isConnected) {
              setChainStatus(chain, 'reconnecting');
              // Attempt to reconnect after a delay
              setTimeout(() => {
                if (web3Service.providers[chain]) {
                  web3Service.reconnectChain(chain, updateGasPrice, setChainStatus);
                }
              }, 5000);
            }
          });
        }
      });

      // Wait for connection to be established
      await connectionPromise;

      // Only set up block listener after connection is confirmed
      provider.on('block', async (blockNumber) => {
        // Check if provider is still valid before making requests
        if (!web3Service.providers[chain] || !isConnected) {
          return;
        }

        try {
          const [block, feeData] = await Promise.all([
            provider.getBlock(blockNumber),
            provider.getFeeData()
          ]);
          
          if (block && feeData.maxPriorityFeePerGas) {
            const baseFeeGwei = parseFloat(ethers.formatUnits(block.baseFeePerGas || 0, 'gwei'));
            const priorityFeeGwei = parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei'));
            updateGasPrice(chain, baseFeeGwei, priorityFeeGwei);
          }
        } catch (error) {
          // Only log if the error isn't due to provider being destroyed
          if (!error.message.includes('provider destroyed')) {
            console.warn(`Error fetching block data for ${chain}:`, error.message);
          }
        }
      });

    } catch (error) {
      console.error(`Failed to connect to ${chain}:`, error);
      setChainStatus(chain, 'error');
    }
  },

  reconnectChain: (chain, updateGasPrice, setChainStatus) => {
    // Clean up existing provider
    if (web3Service.providers[chain]) {
      try {
        web3Service.providers[chain].destroy();
      } catch (error) {
        // Ignore errors during cleanup
      }
      delete web3Service.providers[chain];
    }

    // Attempt to reconnect
    web3Service.connectToChain(chain, updateGasPrice, setChainStatus);
  },

  fetchEthUsdPrice: async () => {
    const { setEthUsdPrice } = useGasStore.getState();
    
    // Use HTTP provider for price fetching to avoid WebSocket issues
    const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`);
    const poolContract = new ethers.Contract(UNISWAP_V3_POOL_ADDRESS, UNISWAP_V3_POOL_ABI, provider);

    try {
      const swapEvents = await poolContract.queryFilter('Swap', -20, 'latest');
      if (swapEvents.length > 0) {
        const lastSwap = swapEvents[swapEvents.length - 1];
        const sqrtPriceX96 = lastSwap.args.sqrtPriceX96;
        
        const sqrtPriceX96_BI = BigInt(sqrtPriceX96.toString());
        const numerator = (sqrtPriceX96_BI * sqrtPriceX96_BI) * (10n ** 12n);
        const denominator = 2n ** 192n;
        const price = Number(numerator * 1000000n / denominator) / 1000000;
        
        setEthUsdPrice(price);
      }
    } catch (error) {
      console.error("Error fetching ETH/USD price:", error);
    }
  },
  
  cleanup: () => {
    // Clear any pending connection timeouts
    Object.values(web3Service.connectionTimeouts).forEach(timeout => {
      clearTimeout(timeout);
    });
    web3Service.connectionTimeouts = {};

    // Clean up providers
    Object.entries(web3Service.providers).forEach(([chain, provider]) => {
      if (provider && provider.destroy) {
        try {
          provider.destroy();
        } catch (error) {
          // Ignore errors during cleanup - provider might already be destroyed
        }
      }
    });
    
    web3Service.providers = {};
    web3Service.isInitialized = false;
  }
};

export default web3Service;