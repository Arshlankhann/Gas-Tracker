import { create } from 'zustand';

export const AGGREGATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export const useGasStore = create((set) => ({
  ethUsdPrice: 0,
  chains: {
    ethereum: { baseFee: 0, priorityFee: 0, history: [], aggregatedHistory: [], status: 'connecting' },
    polygon: { baseFee: 0, priorityFee: 0, history: [], aggregatedHistory: [], status: 'connecting' },
    arbitrum: { baseFee: 0, priorityFee: 0, history: [], aggregatedHistory: [], status: 'connecting' },
  },
  simulation: {
    inputValue: '0.1',
  },

  setEthUsdPrice: (price) => set({ ethUsdPrice: price }),
  setSimulationValue: (value) => set(state => ({ simulation: { ...state.simulation, inputValue: value } })),
  
  updateGasPrice: (chain, baseFee, priorityFee) => {
    set(state => {
      const now = Date.now();
      const newHistory = [...state.chains[chain].history, { time: now, price: baseFee + priorityFee }];
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const filteredHistory = newHistory.filter(p => p.time > twentyFourHoursAgo);

      return {
        chains: {
          ...state.chains,
          [chain]: {
            ...state.chains[chain],
            baseFee,
            priorityFee,
            history: filteredHistory,
            status: 'connected',
          },
        },
      };
    });
  },

  setChainStatus: (chain, status) => {
    set(state => ({
      chains: {
        ...state.chains,
        [chain]: {
          ...state.chains[chain],
          status,
        },
      },
    }));
  },

  aggregateHistory: () => {
    set(state => {
      const newAggregatedChains = {};
      for (const chain in state.chains) {
        const history = state.chains[chain].history;
        if (history.length === 0) {
          newAggregatedChains[chain] = { ...state.chains[chain] };
          continue;
        }

        const aggregated = {};
        history.forEach(point => {
          const intervalStart = Math.floor(point.time / AGGREGATION_INTERVAL_MS) * AGGREGATION_INTERVAL_MS;
          if (!aggregated[intervalStart]) {
            aggregated[intervalStart] = {
              time: intervalStart / 1000,
              open: point.price, high: point.price, low: point.price, close: point.price,
            };
          } else {
            aggregated[intervalStart].high = Math.max(aggregated[intervalStart].high, point.price);
            aggregated[intervalStart].low = Math.min(aggregated[intervalStart].low, point.price);
            aggregated[intervalStart].close = point.price;
          }
        });
        
        const sortedAggregated = Object.values(aggregated).sort((a, b) => a.time - b.time);
        
        newAggregatedChains[chain] = {
          ...state.chains[chain],
          aggregatedHistory: sortedAggregated,
        };
      }
      return { chains: newAggregatedChains };
    });
  },
}));
