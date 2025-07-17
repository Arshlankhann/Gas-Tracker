import React, { memo } from 'react';
import { useGasStore } from '../store/gasStore';
import { CHAIN_DETAILS } from '../services/web3Service';
import '../styles/GasPriceCard.css';

const GasPriceCard = memo(({ chain }) => {
    const { name, symbol, color } = CHAIN_DETAILS[chain];
    const { baseFee, priorityFee, status } = useGasStore(state => state.chains[chain]);
    const totalGas = baseFee + priorityFee;

    const StatusIndicator = () => {
        const statusClasses = `status-indicator ${status}`;
        return <div className={statusClasses} title={status}></div>;
    };

    return (
        <div className="gas-card" style={{ borderLeftColor: color }}>
            <div className="gas-card-header">
                <div className="gas-card-title-group">
                    <h3 className="gas-card-title">{name}</h3>
                    <StatusIndicator />
                </div>
                <span className="gas-card-symbol">{symbol}</span>
            </div>
            <div className="gas-card-body">
                <div className="gas-card-total">
                    {totalGas > 0 ? totalGas.toFixed(2) : '--'}
                    <span className="gwei-unit">Gwei</span>
                </div>
                <div className="gas-card-breakdown">
                    Base: {baseFee.toFixed(2)} | Priority: {priorityFee.toFixed(2)}
                </div>
            </div>
        </div>
    );
});

export default GasPriceCard;