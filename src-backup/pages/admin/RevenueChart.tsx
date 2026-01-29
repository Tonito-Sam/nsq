import React from 'react';
import { Line, Bar } from 'react-chartjs-2';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);


interface RevenueChartProps {
  months: string[];
  projection: { [key: string]: any }[];
  revenueDrivers: { name: string; color?: string }[];
}


const driverColors = [
  '#2563eb', // blue
  '#f59e42', // orange
  '#10b981', // green
  '#e11d48', // red
  '#6366f1', // indigo
  '#fbbf24', // yellow
];

const RevenueChart: React.FC<RevenueChartProps> = ({ months, projection, revenueDrivers }) => {
  const [chartType, setChartType] = React.useState<'line' | 'bar'>('line');

  const totalRevenue = projection.map(row =>
    revenueDrivers.reduce((sum, driver) => sum + (row[driver.name] as number), 0)
  );

  const datasets = [
    {
      label: 'Total Revenue',
      data: totalRevenue,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.1)',
      fill: true,
      tension: 0.3,
      type: chartType,
      pointRadius: 1.5,
      borderWidth: 2,
      order: 0,
    },
    ...revenueDrivers.map((driver, idx) => ({
      label: driver.name,
      data: projection.map(row => row[driver.name] as number),
      borderColor: driverColors[idx % driverColors.length],
      backgroundColor: chartType === 'bar' ? driverColors[idx % driverColors.length] + '80' : 'transparent',
      fill: false,
      tension: 0.3,
      type: chartType,
      pointRadius: 1,
      borderWidth: 1.5,
      order: 1,
    })),
  ];

  const data = {
    labels: months,
    datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Projected Revenue Growth (Monthly)',
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) label += '$' + context.parsed.y.toLocaleString();
            return label;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => '$' + value.toLocaleString(),
        },
      },
      x: {
        maxTicksLimit: 12,
      },
    },
  };

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          className={`px-3 py-1 rounded border text-sm ${chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'}`}
          onClick={() => setChartType('line')}
        >
          Line Chart
        </button>
        <button
          className={`px-3 py-1 rounded border text-sm ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'}`}
          onClick={() => setChartType('bar')}
        >
          Bar Chart
        </button>
      </div>
      {chartType === 'line' ? (
        <Line data={data} options={options} height={320} />
      ) : (
        <Bar data={data} options={options} height={320} />
      )}
    </div>
  );
};

export default RevenueChart;
