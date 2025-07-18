import React, { useEffect, useRef, memo } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useGasStore } from '../store/gasStore';
import { CHAIN_DETAILS } from '../services/web3Service';
import '../styles/GasChart.css';

const GasChart = memo(({ chain }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  const data = useGasStore(state => state.chains[chain]?.aggregatedHistory || []);
  const connectionStatus = useGasStore(state => state.chains[chain]?.status || 'disconnected');
  const { name, color } = CHAIN_DETAILS[chain];

  useEffect(() => {
    if (!chartContainerRef.current || chartContainerRef.current.clientWidth === 0) {
      return;
    }

    const createChartInstance = () => {
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
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 3,
            fixLeftEdge: true,
            lockVisibleTimeRangeOnResize: true,
          },
          rightPriceScale: {
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
          },
        });

        chartRef.current = chart;

        // Create series with fallback methods
        let series = null;
        
        try {
          // Try line series first (most reliable)
          series = chart.addLineSeries({
            color: color,
            lineWidth: 2,
            priceFormat: {
              type: 'price',
              precision: 2,
              minMove: 0.01,
            },
          });
          console.log(`Successfully created line series for ${chain}`);
        } catch (error) {
          console.error(`Failed to create line series for ${chain}:`, error);
          
          // Fallback to area series
          try {
            series = chart.addAreaSeries({
              topColor: color + '80',
              bottomColor: color + '20',
              lineColor: color,
              lineWidth: 2,
              priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
              },
            });
            console.log(`Successfully created area series for ${chain}`);
          } catch (areaError) {
            console.error(`Failed to create area series for ${chain}:`, areaError);
          }
        }

        if (!series) {
          throw new Error(`Could not create any chart series for ${chain}`);
        }

        seriesRef.current = series;

        const handleResize = () => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({ 
              width: chartContainerRef.current.clientWidth 
            });
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
        console.error(`Error creating chart for ${chain}:`, error);
      }
    };

    // Small delay to ensure container is ready
    const timeoutId = setTimeout(createChartInstance, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [chain, color]);

  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      try {
        // Transform and validate data
        const transformedData = data.map(item => {
          let value;
          
          // Handle different data formats
          if (item.close !== undefined) {
            value = item.close;
          } else if (item.value !== undefined) {
            value = item.value;
          } else if (item.price !== undefined) {
            value = item.price;
          } else if (item.y !== undefined) {
            value = item.y;
          } else {
            value = 0;
          }

          return {
            time: item.time,
            value: parseFloat(value) || 0
          };
        });

        // Filter out invalid data points
        const validData = transformedData.filter(item => 
          item.time && 
          typeof item.value === 'number' && 
          !isNaN(item.value) &&
          item.value >= 0
        );

        if (validData.length > 0) {
          // Sort data by time to ensure proper display
          validData.sort((a, b) => a.time - b.time);
          
          seriesRef.current.setData(validData);
          
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          console.warn(`No valid data to display for ${chain}`);
        }
      } catch (error) {
        console.error(`Error setting chart data for ${chain}:`, error);
      }
    }
  }, [data, chain]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#10B981';
      case 'connecting': return '#F59E0B';
      case 'reconnecting': return '#EF4444';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">{name} Gas Price (15m Intervals)</h3>
        <div className="chart-status">
          <span 
            className="status-indicator"
            style={{ 
              backgroundColor: getStatusColor(connectionStatus),
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              display: 'inline-block',
              marginRight: '8px'
            }}
          />
          <span className="status-text" style={{ fontSize: '12px', opacity: 0.7 }}>
            {getStatusText(connectionStatus)}
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} className="chart-wrapper" />
      {data.length === 0 && (
        <div className="chart-placeholder" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          opacity: 0.5
        }}>
          {/* <p>No data available</p> */}
          <p style={{ fontSize: '12px' }}>Waiting for gas price data...</p>
        </div>
      )}
    </div>
  );
});

export default GasChart;