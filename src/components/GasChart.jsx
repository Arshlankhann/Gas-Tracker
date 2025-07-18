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
      // Clean up previous chart if exists
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }

      // Create chart with basic options
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
        timeScale: { 
          timeVisible: true, 
          secondsVisible: false 
        },
      });

      chartRef.current = chart;

      // Try different approaches to create series
      let series = null;

      // Method 1: Try the old API first
      const oldApiMethods = [
        () => chart.addLineSeries({ color: color, lineWidth: 2 }),
        () => chart.addAreaSeries({ 
          topColor: color + '80', 
          bottomColor: color + '20', 
          lineColor: color, 
          lineWidth: 2 
        }),
        () => chart.addHistogramSeries({ color: color }),
        () => chart.addCandlestickSeries({
          upColor: color,
          downColor: '#E53E3E',
          borderDownColor: '#E53E3E',
          borderUpColor: color,
          wickDownColor: '#E53E3E',
          wickUpColor: color,
        })
      ];

      // Method 2: Try the new API
      const newApiConfigs = [
        ['Line', { color: color, lineWidth: 2 }],
        ['Area', { 
          topColor: color + '80', 
          bottomColor: color + '20', 
          lineColor: color, 
          lineWidth: 2 
        }],
        ['Histogram', { color: color }],
        ['Candlestick', {
          upColor: color,
          downColor: '#E53E3E',
          borderDownColor: '#E53E3E',
          borderUpColor: color,
          wickDownColor: '#E53E3E',
          wickUpColor: color,
        }]
      ];

      // Try old API methods first
      for (const method of oldApiMethods) {
        try {
          series = method();
          console.log('Successfully created series with old API');
          break;
        } catch (error) {
          // Continue to next method
        }
      }

      // If old API failed, try new API
      if (!series && chart.addSeries) {
        for (const [type, options] of newApiConfigs) {
          try {
            series = chart.addSeries(type, options);
            console.log(`Successfully created ${type} series with new API`);
            break;
          } catch (error) {
            // Continue to next type
          }
        }
      }

      // If still no series, try minimal configuration
      if (!series) {
        try {
          // Try the most basic line series
          if (chart.addLineSeries) {
            series = chart.addLineSeries({ color: color });
          } else if (chart.addSeries) {
            series = chart.addSeries('Line', { color: color });
          }
        } catch (error) {
          console.error('Failed to create minimal series:', error);
        }
      }

      if (!series) {
        throw new Error('Could not create any chart series');
      }

      seriesRef.current = series;

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
          chartRef.current = null;
          seriesRef.current = null;
        }
      };
    } catch (error) {
      console.error("Error creating chart:", error);
    }
  }, [chain, color]);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      try {
        // Ensure data is in the correct format
        let transformedData = data;
        
        // Check if data needs transformation
        const firstItem = data[0];
        
        // If it's candlestick data but we're using line/area series
        if (firstItem.close !== undefined && firstItem.open !== undefined) {
          // Transform to line data
          transformedData = data.map(item => ({
            time: item.time,
            value: item.close
          }));
        } else if (firstItem.value === undefined) {
          // If no value property, try to use a reasonable default
          transformedData = data.map(item => ({
            time: item.time,
            value: item.close || item.price || item.y || 0
          }));
        }

        // Validate data format
        const validData = transformedData.filter(item => 
          item.time && (item.value !== undefined || item.close !== undefined)
        );

        if (validData.length > 0) {
          seriesRef.current.setData(validData);
          
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          console.warn('No valid data to display');
        }
      } catch (error) {
        console.error("Error setting chart data:", error);
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