import { ethers } from 'ethers';
import { useGasStore } from '../store/gasStore';

// Using the API key you provided.
const YOUR_INFURA_KEY = "19fb1db338734131b56ab8f56b7420ee";

const isDevelopment = process.env.NODE_ENV === 'development';

const RPC_ENDPOINTS = {
  ethereum: isDevelopment 
    ? `https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`
    : `wss://mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
  polygon: isDevelopment
    ? `https://polygon-mainnet.infura.io/v3/${YOUR_INFURA_KEY}`
    : `wss://polygon-mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
  arbitrum: isDevelopment
    ? `https://arbitrum-mainnet.infura.io/v3/${YOUR_INFURA_KEY}`
    : `wss://arbitrum-mainnet.infura.io/ws/v3/${YOUR_INFURA_KEY}`,
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
  pollingIntervals: {},
  connectionTimeouts: {},
  retryAttempts: {},
  maxRetries: 3,
  retryDelay: 5000,
  
  initProviders: () => {
    if (web3Service.isInitialized) {
      return;
    }
    
    const { updateGasPrice, setChainStatus } = useGasStore.getState();
    const chains = Object.keys(RPC_ENDPOINTS);

    // Initialize retry attempts
    chains.forEach(chain => {
      web3Service.retryAttempts[chain] = 0;
    });

    if (isDevelopment) {
      // In development, use HTTP providers with polling
      chains.forEach(chain => {
        web3Service.initHttpProvider(chain, updateGasPrice, setChainStatus);
      });
    } else {
      // In production, stagger WebSocket connections to avoid overwhelming Infura
      chains.forEach((chain, index) => {
        web3Service.connectionTimeouts[chain] = setTimeout(() => {
          web3Service.connectToChain(chain, updateGasPrice, setChainStatus);
        }, index * 2000); // 2 second delay between each connection
      });
    }
    
    web3Service.isInitialized = true;
  },

  initHttpProvider: (chain, updateGasPrice, setChainStatus) => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chain], null, {
        staticNetwork: true, // Prevents unnecessary network calls
      });
      
      web3Service.providers[chain] = provider;
      setChainStatus(chain, 'connected');

      // Poll for gas prices every 15 seconds in development
      web3Service.pollingIntervals[chain] = setInterval(async () => {
        try {
          const [block, feeData] = await Promise.all([
            provider.getBlock('latest'),
            provider.getFeeData()
          ]);
          
          if (block && feeData.maxPriorityFeePerGas) {
            const baseFeeGwei = parseFloat(ethers.formatUnits(block.baseFeePerGas || 0, 'gwei'));
            const priorityFeeGwei = parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei'));
            updateGasPrice(chain, baseFeeGwei, priorityFeeGwei);
          }
        } catch (error) {
          console.warn(`Error polling ${chain}:`, error.message);
          setChainStatus(chain, 'error');
        }
      }, 15000);

      console.log(`${chain} HTTP provider initialized`);

    } catch (error) {
      console.error(`Failed to create HTTP provider for ${chain}:`, error);
      setChainStatus(chain, 'error');
    }
  },

  connectToChain: async (chain, updateGasPrice, setChainStatus) => {
    try {
      if (web3Service.providers[chain]) {
        return;
      }

      setChainStatus(chain, 'connecting');

      const provider = new ethers.WebSocketProvider(RPC_ENDPOINTS[chain], null, {
        staticNetwork: true,
      });
      
      web3Service.providers[chain] = provider;

      let isConnected = false;
      const connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout for ${chain}`));
        }, 40000); // Increased timeout to 20 seconds

        if (provider._websocket) {
          provider._websocket.on('open', () => {
            clearTimeout(timeout);
            isConnected = true;
            web3Service.retryAttempts[chain] = 0; // Reset retry counter on success
            setChainStatus(chain, 'connected');
            console.log(`${chain} WebSocket connected`);
            resolve();
          });
          
          provider._websocket.on('error', (err) => {
            clearTimeout(timeout);
            console.error(`${chain} WebSocket error:`, err);
            setChainStatus(chain, 'error');
            reject(err);
          });
          
          provider._websocket.on('close', (code, reason) => {
            console.log(`${chain} WebSocket closed:`, code, reason);
            if (isConnected) {
              setChainStatus(chain, 'reconnecting');
              // Attempt to reconnect after a delay
              setTimeout(() => {
                if (web3Service.providers[chain]) {
                  web3Service.reconnectChain(chain, updateGasPrice, setChainStatus);
                }
              }, web3Service.retryDelay);
            }
          });
        }
      });

      await connectionPromise;

      // Only set up block listener after connection is confirmed
      provider.on('block', async (blockNumber) => {
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
          if (!error.message.includes('provider destroyed')) {
            console.warn(`Error fetching block data for ${chain}:`, error.message);
          }
        }
      });

    } catch (error) {
      console.error(`Failed to connect to ${chain}:`, error);
      setChainStatus(chain, 'error');
      
      // Implement retry logic
      if (web3Service.retryAttempts[chain] < web3Service.maxRetries) {
        web3Service.retryAttempts[chain]++;
        const delay = web3Service.retryDelay * web3Service.retryAttempts[chain];
        console.log(`Retrying ${chain} connection in ${delay}ms (attempt ${web3Service.retryAttempts[chain]}/${web3Service.maxRetries})`);
        
        setTimeout(() => {
          web3Service.reconnectChain(chain, updateGasPrice, setChainStatus);
        }, delay);
      } else {
        console.error(`Max retries reached for ${chain}, giving up`);
        setChainStatus(chain, 'error');
      }
    }
  },

  reconnectChain: (chain, updateGasPrice, setChainStatus) => {
    // Clean up existing provider
    if (web3Service.providers[chain]) {
      try {
        web3Service.providers[chain].destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      delete web3Service.providers[chain];
    }

    // Attempt to reconnect
    web3Service.connectToChain(chain, updateGasPrice, setChainStatus);
  },

  fetchEthUsdPrice: async () => {
    const { setEthUsdPrice } = useGasStore.getState();
    
    try {
      const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${YOUR_INFURA_KEY}`);
      const poolContract = new ethers.Contract(UNISWAP_V3_POOL_ADDRESS, UNISWAP_V3_POOL_ABI, provider);

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

  // Manual retry method for failed connections
  retryConnection: (chain) => {
    const { updateGasPrice, setChainStatus } = useGasStore.getState();
    web3Service.retryAttempts[chain] = 0; // Reset retry counter
    web3Service.reconnectChain(chain, updateGasPrice, setChainStatus);
  },

  // Get connection status
  getConnectionStatus: (chain) => {
    const provider = web3Service.providers[chain];
    if (!provider) return 'disconnected';
    
    if (provider._websocket) {
      return provider._websocket.readyState === 1 ? 'connected' : 'disconnected';
    }
    
    return 'connected'; // HTTP provider
  },
  
  cleanup: () => {
    // Clear connection timeouts
    Object.values(web3Service.connectionTimeouts).forEach(timeout => {
      clearTimeout(timeout);
    });
    web3Service.connectionTimeouts = {};

    // Clear polling intervals
    Object.values(web3Service.pollingIntervals).forEach(interval => {
      clearInterval(interval);
    });
    web3Service.pollingIntervals = {};

    // Clean up providers
    Object.entries(web3Service.providers).forEach(([chain, provider]) => {
      if (provider) {
        try {
          if (provider.destroy) {
            provider.destroy();
          } else if (provider.removeAllListeners) {
            provider.removeAllListeners();
          }
        } catch (error) {
          console.warn(`Error cleaning up ${chain} provider:`, error);
        }
      }
    });
    
    web3Service.providers = {};
    web3Service.isInitialized = false;
    web3Service.retryAttempts = {};
  }
};

export default web3Service;