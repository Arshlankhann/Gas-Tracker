import React, { useState, useEffect, memo } from 'react';
import { useGasStore } from '../store/gasStore';
import { CHAIN_DETAILS, GAS_LIMIT_STANDARD_TX } from '../services/web3Service';
import { ethers } from 'ethers';
import '../styles/SimulationPanel.css';

const SimulationPanel = memo(() => {
  const chains = useGasStore(state => state.chains);
  const ethUsdPrice = useGasStore(state => state.ethUsdPrice);
  const simulationInputValue = useGasStore(state => state.simulation.inputValue);
  const setSimulationValue = useGasStore(state => state.setSimulationValue);

  const [costs, setCosts] = useState({});

  useEffect(() => {
    if (ethUsdPrice > 0) {
      const newCosts = {};
      const txValue = parseFloat(simulationInputValue) || 0;
      Object.keys(chains).forEach(chain => {
        try {
            const { baseFee, priorityFee } = chains[chain];
            const totalGasGwei = baseFee + priorityFee;
            
            // This check prevents calculations with invalid numbers that cause crashes.
            if (isNaN(totalGasGwei) || totalGasGwei <= 0) {
                return; // Skip this chain if gas is invalid
            }
            
            // FIX: Round the gwei value to prevent "too many decimals" error from ethers.js
            const roundedGasGwei = totalGasGwei.toFixed(9);
            
            const gasCostInWei = ethers.parseUnits(roundedGasGwei, 'gwei') * BigInt(GAS_LIMIT_STANDARD_TX);
            const totalGasEth = ethers.formatUnits(gasCostInWei, 'ether');

            const costUsd = parseFloat(totalGasEth) * ethUsdPrice;
            newCosts[chain] = { costUsd, totalEth: txValue + parseFloat(totalGasEth) };
        } catch (e) {
            // This catch block will prevent the whole app from crashing if a calculation fails.
            console.error("Could not calculate cost for", chain, e);
        }
      });
      setCosts(newCosts);
    }
  }, [simulationInputValue, chains, ethUsdPrice]);

  return (
    <div className="simulation-panel">
      <h2 className="simulation-title">Transaction Cost Simulation</h2>
      <div className="simulation-input-group">
        <label htmlFor="txValue">Transaction Value:</label>
        <input
          type="number"
          id="txValue"
          value={simulationInputValue}
          onChange={(e) => setSimulationValue(e.target.value)}
          step="0.01"
          min="0"
        />
        <span>ETH/MATIC</span>
      </div>
      
      <div className="simulation-table-wrapper">
        <table className="simulation-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th className="text-right">Gas Cost (USD)</th>
              <th className="text-right">Total Cost (USD)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(chains).map(chain => {
              const cost = costs[chain];
              const txValueUsd = (parseFloat(simulationInputValue) || 0) * ethUsdPrice;
              return (
                <tr key={chain}>
                  <td>
                    <div className="chain-cell">
                      <div className="chain-color-dot" style={{backgroundColor: CHAIN_DETAILS[chain].color}}></div>
                      <span>{CHAIN_DETAILS[chain].name}</span>
                    </div>
                  </td>
                  <td className="text-right cost-gas">${cost ? cost.costUsd.toFixed(4) : '...'}</td>
                  <td className="text-right cost-total">${cost ? (cost.costUsd + txValueUsd).toFixed(4) : '...'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default SimulationPanel;
