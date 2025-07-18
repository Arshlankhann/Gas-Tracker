import React, { useEffect, useRef } from 'react';
import { useGasStore } from './store/gasStore';
import web3Service from './services/web3Service';
import Header from './components/Header';
import GasPriceCard from './components/GasPriceCard';
import GasChart from './components/GasChart';
import SimulationPanel from './components/SimulationPanel';
import { CHAIN_DETAILS } from './services/web3Service';
import './styles/App.css';

function App() {
  const aggregateHistory = useGasStore(state => state.aggregateHistory);
  const effectRan = useRef(false);

  useEffect(() => {
    // Prevent double execution in development mode (React 18 StrictMode)
    if (effectRan.current === false || process.env.NODE_ENV !== 'development') {
      let mounted = true;
      let priceFetchInterval;
      let historyAggregationInterval;
      let initialFetchTimeout;

      const initServices = async () => {
        if (!mounted) return;

        try {
          // Initialize providers
          web3Service.initProviders();
          
          // Set up intervals only if still mounted
          if (mounted) {
            priceFetchInterval = setInterval(() => {
              if (mounted) {
                web3Service.fetchEthUsdPrice();
              }
            }, 30000);
            
            historyAggregationInterval = setInterval(() => {
              if (mounted) {
                aggregateHistory();
              }
            }, 60000);

            // Initial fetch after a short delay to allow providers to connect
            initialFetchTimeout = setTimeout(() => {
              if (mounted) {
                web3Service.fetchEthUsdPrice();
              }
            }, 2000);
          }
        } catch (error) {
          console.error('Failed to initialize services:', error);
        }
      };

      initServices();

      return () => {
        mounted = false;
        
        // Clear all intervals and timeouts
        if (priceFetchInterval) clearInterval(priceFetchInterval);
        if (historyAggregationInterval) clearInterval(historyAggregationInterval);
        if (initialFetchTimeout) clearTimeout(initialFetchTimeout);
        
        // Cleanup web3 service
        web3Service.cleanup();
      };
    }

    return () => {
      effectRan.current = true;
    };
  }, [aggregateHistory]);

  return (
    <div className="app-container">
      <Header />
      
      <main>
        <div className="gas-cards-grid">
          {Object.keys(CHAIN_DETAILS).map(chain => (
            <GasPriceCard key={chain} chain={chain} />
          ))}
        </div>

        <div className="gas-charts-grid">
           {Object.keys(CHAIN_DETAILS).map(chain => (
            <GasChart key={chain} chain={chain} />
          ))}
        </div>

        <SimulationPanel />
      </main>
      
      <footer className="app-footer">
        <p>Gas prices are in Gwei. Chart data is aggregated into 15-minute candlesticks.</p>
        <p>Disclaimer: This is for demonstration purposes. Not financial advice.</p>
      </footer>
    </div>
  );
}

export default App;