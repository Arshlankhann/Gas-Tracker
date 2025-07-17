import React, { memo } from 'react';
import { useGasStore } from '../store/gasStore';
import '../styles/Header.css';

const Header = memo(() => {
  const ethUsdPrice = useGasStore(state => state.ethUsdPrice);
  return (
    <header className="app-header">
      <h1 className="header-title">Cross-Chain Gas Tracker</h1>
      <div className="price-display">
        <span className="price-label">Live ETH/USD</span>
        <span className="price-value">
          ${ethUsdPrice > 0 ? ethUsdPrice.toFixed(2) : 'Loading...'}
        </span>
      </div>
    </header>
  );
});

export default Header;
