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
  
  initProviders: () => {
    const { updateGasPrice, setChainStatus } = useGasStore.getState();

    Object.keys(RPC_ENDPOINTS).forEach(chain => {
      try {
        const provider = new ethers.WebSocketProvider(RPC_ENDPOINTS[chain]);
        web3Service.providers[chain] = provider;

        provider.on('block', async (blockNumber) => {
          try {
            const [block, feeData] = await Promise.all([provider.getBlock(blockNumber), provider.getFeeData()]);
            if (block && feeData.maxPriorityFeePerGas) {
              const baseFeeGwei = parseFloat(ethers.formatUnits(block.baseFeePerGas || 0, 'gwei'));
              const priorityFeeGwei = parseFloat(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei'));
              updateGasPrice(chain, baseFeeGwei, priorityFeeGwei);
            }
          } catch (error) {
            // It's normal for some of these to fail occasionally, so we won't log every single one.
          }
        });

        if (provider._websocket) {
            provider._websocket.on('open', () => setChainStatus(chain, 'connected'));
            provider._websocket.on('error', (err) => {
                console.error(`${chain} WebSocket error:`, err);
                setChainStatus(chain, 'error');
            });
            provider._websocket.on('close', () => setChainStatus(chain, 'reconnecting'));
        }

      } catch (error) {
        console.error(`Failed to connect to ${chain}:`, error);
        setChainStatus(chain, 'error');
      }
    });
  },

  fetchEthUsdPrice: async () => {
    const { setEthUsdPrice } = useGasStore.getState();
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
    Object.values(web3Service.providers).forEach(provider => {
      if (provider && provider.destroy) {
        provider.destroy();
      }
    });
    web3Service.providers = {};
  }
};

export default web3Service;
