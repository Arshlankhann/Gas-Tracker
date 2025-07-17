import React, { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useGasStore } from '../store/gasStore';
import { CHAIN_DETAILS } from '../services/web3Service';
import '../styles/GasChart.css';

const GasChart = memo(({ chain }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  const data = useGasStore(state => state.chains[chain].aggregatedHistory);
  const { name, color } = CHAIN_DETAILS[chain];

  useEffect(() => {
    if (!chartContainerRef.current || chartContainerRef.current.clientWidth === 0) {
      return;
    }

    try {
      // Create chart and store it properly
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
          horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
        },
        timeScale: { timeVisible: true, secondsVisible: false },
      });

      // Store the chart in the ref
      chartRef.current = chart;

      // Add candlestick series using the chart variable
      seriesRef.current = chart.addCandlestickSeries({
        upColor: color,
        downColor: '#E53E3E',
        borderDownColor: '#E53E3E',
        borderUpColor: color,
        wickDownColor: '#E53E3E',
        wickUpColor: color,
      });

      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
        }
      };
    } catch (error) {
      console.error("Error creating chart:", error);
    }
  }, [chain, color]);

  useEffect(() => {
    if (seriesRef.current && data) {
      seriesRef.current.setData(data);
      if (data.length > 0 && chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data]);

  return (
    <div className="chart-container">
      <h3 className="chart-title">{name} Gas Price (15m Intervals)</h3>
      <div ref={chartContainerRef} className="chart-wrapper" />
    </div>
  );
});

export default GasChart;
