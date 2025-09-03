import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Download, Edit3, Info, HelpCircle } from 'lucide-react';
import RevenueChart from './RevenueChart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Enhanced TypeScript types
interface FundAllocationData {
  title: string;
  allocation: number;
  percentage: number;
  color: string;
}

interface FundAllocation {
  ops: FundAllocationData;
  market: FundAllocationData;
  brand: FundAllocationData;
  buffer: FundAllocationData;
}

interface RevenueDriver {
  name: string;
  type: 'commission' | 'subscription' | 'ads' | 'api';
  calc: (month: number, year: number, txPerDay: number) => number;
  description: string;
}

interface RevenueScenario {
  label: string;
  value: number;
}

interface MonthlyRevenueData {
  month: string;
  year: number;
  [key: string]: string | number;
}

interface YearlyRevenueData {
  year: number;
  total: number;
  [key: string]: number;
}

interface ExpenseItem {
  name: string;
  type: string;
  monthly: number;
}

interface ExpenseTableProps {
  category: string;
  title: string;
  allocation: number;
  color: string;
}

const fundAllocation: FundAllocation = {
  ops: {
    title: 'Operations',
    allocation: 420000, // $420K
    percentage: 35,
    color: 'bg-pink-500'
  },
  market: {
    title: 'Go to Market',
    allocation: 480000, // $480K
    percentage: 40,
    color: 'bg-slate-800'
  },
  brand: {
    title: 'Brand Positioning',
    allocation: 180000, // $180K
    percentage: 15,
    color: 'bg-blue-600'
  },
  buffer: {
    title: 'Buffer (Runway)',
    allocation: 120000, // $120K
    percentage: 10,
    color: 'bg-teal-500'
  }
};

const months: string[] = Array.from({ length: 24 }, (_, i) => {
  const date = new Date(2026, i);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
});

// 5-year (60 months) months array
const months5y: string[] = Array.from({ length: 60 }, (_, i) => {
  const date = new Date(2026, i);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
});

// Enhanced revenue drivers with descriptions
const revenueDrivers: RevenueDriver[] = [
  {
    name: 'Transaction Fees',
    type: 'commission',
    description: 'Commission from marketplace transactions at 1.5% of $50 average transaction value',
    calc: (month: number, year: number, txPerDay: number): number => {
      return txPerDay * 30 * 50 * 0.015;
    }
  },
  {
    name: 'Storefronts Subscription',
    type: 'subscription',
    description: 'Monthly subscription from 300 stores at $5/month, starting after 12 months',
    calc: (month: number, year: number, txPerDay: number): number => {
      if (year === 0) return 0;
      return 300 * 5;
    }
  },
  {
    name: 'Content Monetization',
    type: 'commission',
    description: 'Revenue from content transactions (10% of total transactions)',
    calc: (month: number, year: number, txPerDay: number): number => {
      return txPerDay * 30 * 0.1 * 50 * 0.015;
    }
  },
  {
    name: 'Advertisements',
    type: 'ads',
    description: 'Ad revenue at $5 per ad, with 1 ad per 10 transactions',
    calc: (month: number, year: number, txPerDay: number): number => {
      return txPerDay * 30 * 0.1 * 5;
    }
  },
  {
    name: 'Cross-border Payments',
    type: 'commission',
    description: 'Commission from international transactions (20% of total transactions)',
    calc: (month: number, year: number, txPerDay: number): number => {
      return txPerDay * 30 * 0.2 * 50 * 0.015;
    }
  },
  {
    name: 'Partnerships & APIs',
    type: 'api',
    description: 'API revenue starting at $500/month, growing 50% annually',
    calc: (month: number, year: number, txPerDay: number): number => {
      return 500 * Math.pow(1.5, year);
    }
  }
];

// Revenue scenario options
const revenueScenarios: RevenueScenario[] = [
  { label: '200 tx/day (default)', value: 200 },
  { label: '500 tx/day', value: 500 },
  { label: '1000 tx/day', value: 1000 },
];

// Generate revenue projection for a scenario with enhanced typing
const getRevenueProjection = (startTxPerDay: number = 200): MonthlyRevenueData[] => {
  const rows: MonthlyRevenueData[] = [];
  let txPerDay = startTxPerDay;
  
  for (let year = 0; year < 5; year++) {
    for (let m = 0; m < 12; m++) {
      const monthIndex = year * 12 + m;
      const monthData: MonthlyRevenueData = { 
        month: months5y[monthIndex], 
        year: year + 2026 
      };
      
      revenueDrivers.forEach(driver => {
        monthData[driver.name] = driver.calc(monthIndex, year, txPerDay);
      });
      
      rows.push(monthData);
    }
    txPerDay *= 2; // Double transactions each year
  }
  return rows;
};

// Yearly aggregation with enhanced typing
const getYearlyRevenue = (projection: MonthlyRevenueData[]): YearlyRevenueData[] => {
  const years = [2026, 2027, 2028, 2029, 2030];
  
  return years.map((year, i) => {
    const months = projection.slice(i * 12, (i + 1) * 12);
    const row: YearlyRevenueData = { year, total: 0 };
    
    revenueDrivers.forEach(driver => {
      row[driver.name] = months.reduce((sum, m) => sum + (m[driver.name] as number), 0);
    });
    
    row.total = revenueDrivers.reduce((sum, d) => sum + row[d.name], 0);
    return row;
  });
};

const AssumptionsCards: React.FC<{ scenario: number }> = ({ scenario }) => {
  // Get projection for chart
  const projection = getRevenueProjection(scenario);
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* ...existing cards... */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Transaction Value
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average value per transaction on the platform</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$50</div>
            <div className="text-sm text-muted-foreground">Average per transaction</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Commission Rate
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Platform commission rate on transactions</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.5%</div>
            <div className="text-sm text-muted-foreground">On all relevant revenue drivers</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Starting Daily Transactions
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Initial daily transaction volume, doubles annually</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scenario} / day</div>
            <div className="text-sm text-muted-foreground">Doubles every year</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Storefronts Subscription
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recurring revenue from storefront subscriptions</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$5/mo x 300 stores</div>
            <div className="text-sm text-muted-foreground">Starts after 12 months (2027)</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Ads & Content
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revenue from advertising and content monetization</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$5/ad, 10% of txs are content</div>
            <div className="text-sm text-muted-foreground">1 ad per 10 txs, 10% txs are content</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Cross-border & API
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revenue from international transactions and API services</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20% txs cross-border, $500/mo API</div>
            <div className="text-sm text-muted-foreground">API grows 50%/yr, cross-border 20% of txs</div>
          </CardContent>
        </Card>
      </div>
      <div className="mb-8">
        <RevenueChart months={months5y} projection={projection} revenueDrivers={revenueDrivers} />
      </div>
    </div>
  );
};

const RevenueTable: React.FC<{ scenario: number; view: 'month' | 'year' }> = ({ scenario, view }) => {
  const projection = getRevenueProjection(scenario);
  const totals: Record<string, number> = {};
  
  revenueDrivers.forEach(driver => {
    totals[driver.name] = projection.reduce((sum, row) => sum + (row[driver.name] as number), 0);
  });
  
  const totalRevenue = Object.values(totals).reduce((a, b) => a + b, 0);

  const exportRevenueToCSV = (): void => {
    let headers: string[];
    let rows: (string | number)[][];
    
    if (view === 'year') {
      const yearly = getYearlyRevenue(projection);
      headers = ['Year', ...revenueDrivers.map(d => d.name), 'Yearly Total'];
      rows = yearly.map(row => [
        row.year,
        ...revenueDrivers.map(driver => row[driver.name]),
        row.total
      ]);
    } else {
      headers = ['Month', ...revenueDrivers.map(d => d.name), 'Monthly Total'];
      rows = projection.map(row => {
        const monthlyTotal = revenueDrivers.reduce((sum, driver) => sum + (row[driver.name] as number), 0);
        return [
          row.month,
          ...revenueDrivers.map(driver => row[driver.name]),
          monthlyTotal
        ];
      });
    }
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-projection-${view}-${scenario}tx.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (view === 'year') {
    const yearly = getYearlyRevenue(projection);
    return (
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
                5-Year Revenue Projection (Yearly)
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-5 h-5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Annual revenue aggregated by revenue stream</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Total Revenue (5 Years): {formatCurrency(totalRevenue)}</div>
              </div>
            </div>
            <Button 
              onClick={exportRevenueToCSV} 
              variant="outline" 
              size="sm"
              aria-label="Export yearly revenue data to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] w-full overflow-x-auto">
            <div className="min-w-max">
              <Table role="table" aria-label="Yearly revenue projection table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[120px] text-center">
                      Year
                    </TableHead>
                    {revenueDrivers.map(driver => (
                      <TableHead key={driver.name} className="min-w-[160px] text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {driver.name}
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{driver.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[160px] text-center font-bold">Yearly Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearly.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="sticky left-0 bg-background text-center font-medium">
                        {row.year}
                      </TableCell>
                      {revenueDrivers.map(driver => (
                        <TableCell key={driver.name} className="text-center">
                          {formatCurrency(row[driver.name])}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        {formatCurrency(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/20">
                    <TableCell className="sticky left-0 bg-muted/20 font-bold">5Y TOTAL</TableCell>
                    {revenueDrivers.map(driver => (
                      <TableCell key={driver.name} className="text-center font-bold">
                        {formatCurrency(totals[driver.name])}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold text-lg">
                      {formatCurrency(totalRevenue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Monthly view (default)
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
              5-Year Revenue Projection (Monthly)
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-5 h-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Monthly revenue breakdown by revenue stream over 60 months</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>Total Revenue (5 Years): {formatCurrency(totalRevenue)}</div>
            </div>
          </div>
          <Button 
            onClick={exportRevenueToCSV} 
            variant="outline" 
            size="sm"
            aria-label="Export monthly revenue data to CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px] w-full overflow-x-auto">
          <div className="min-w-max">
            <Table role="table" aria-label="Monthly revenue projection table">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">
                    Month
                  </TableHead>
                  {revenueDrivers.map(driver => (
                    <TableHead key={driver.name} className="min-w-[160px] text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {driver.name}
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{driver.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[160px] text-center font-bold">Monthly Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projection.map((row, i) => {
                  const monthlyTotal = revenueDrivers.reduce((sum, driver) => sum + (row[driver.name] as number), 0);
                  return (
                    <TableRow key={i}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {row.month}
                      </TableCell>
                      {revenueDrivers.map(driver => (
                        <TableCell key={driver.name} className="text-center">
                          {formatCurrency(row[driver.name] as number)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        {formatCurrency(monthlyTotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 bg-muted/20">
                  <TableCell className="sticky left-0 bg-muted/20 font-bold">5Y TOTAL</TableCell>
                  {revenueDrivers.map(driver => (
                    <TableCell key={driver.name} className="text-center font-bold">
                      {formatCurrency(totals[driver.name])}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-lg">
                    {formatCurrency(totalRevenue)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const baseExpenseCategories = {
  ops: (() => {
    const baseFrontend = 1000;
    const baseQA = 1000;
    const oldFrontend = 4200;
    const oldQA = 3500;
    const diff = (oldFrontend - baseFrontend) + (oldQA - baseQA);
    return [
      { name: 'CEO Salary', type: 'salary', base: 9000 },
      { name: 'CTO Salary', type: 'salary', base: 7500 },
      { name: 'Lead Developer Salary', type: 'salary', base: 6000 },
      { name: 'Backend Developer Salary', type: 'salary', base: 5000 },
      { name: 'DevOps Engineer Salary', type: 'salary', base: 4800 },
      { name: 'Frontend Developer Salary', type: 'salary', base: baseFrontend },
      { name: 'QA Engineer Salary', type: 'salary', base: baseQA },
      { name: 'AWS Infrastructure', type: 'infrastructure', base: 1800 },
      { name: 'Office Rent', type: 'office', base: 2200 + diff },
      { name: 'Utilities & Internet', type: 'office', base: 400 },
      { name: 'Legal & Compliance', type: 'legal', base: 900 },
      { name: 'Accounting & Bookkeeping', type: 'admin', base: 700 },
      { name: 'Insurance', type: 'admin', base: 600 },
      { name: 'Software Licenses', type: 'tools', base: 800 },
      { name: 'Equipment & Hardware', type: 'equipment', base: 700 }
    ];
  })(),
  market: [
    { name: 'Head of Marketing Salary', type: 'salary', base: 7000 },
    { name: 'Sales Manager Salary', type: 'salary', base: 6000 },
    { name: 'Business Development Salary', type: 'salary', base: 5000 },
    { name: 'Customer Success Manager', type: 'salary', base: 4200 },
    { name: 'Digital Advertising (Google, Meta)', type: 'advertising', base: 9000 },
    { name: 'Content Marketing', type: 'content', base: 3500 },
    { name: 'SEO & SEM Tools', type: 'tools', base: 2000 },
    { name: 'CRM & Sales Tools', type: 'tools', base: 2500 },
    { name: 'Trade Shows & Events', type: 'events', base: 6000 },
    { name: 'PR & Media Relations', type: 'pr', base: 4500 },
    { name: 'Influencer Partnerships', type: 'partnerships', base: 4000 },
    { name: 'Market Research', type: 'research', base: 2500 },
    { name: 'Lead Generation Tools', type: 'tools', base: 2200 },
    { name: 'Sales Commissions', type: 'commissions', base: 7000 }
  ],
  brand: [
    { name: 'Brand Manager Salary', type: 'salary', base: 4000 },
    { name: 'Creative Director Salary', type: 'salary', base: 3500 },
    { name: 'Brand Maintenance & Updates', type: 'maintenance', base: 3000 },
    { name: 'App Store Optimization (ASO)', type: 'optimization', base: 2200 },
    { name: 'Website Maintenance & Updates', type: 'web-maintenance', base: 1800 },
    { name: 'Social Media Content Creation', type: 'content', base: 3500 },
    { name: 'Brand Monitoring & Reputation', type: 'monitoring', base: 1500 },
    { name: 'User Experience Research', type: 'research', base: 2200 },
    { name: 'Brand Campaign Management', type: 'campaigns', base: 3200 },
    { name: 'Design Tools & Software', type: 'tools', base: 1200 },
    { name: 'Photography & Asset Updates', type: 'assets', base: 1800 },
    { name: 'Brand Analytics & Tracking', type: 'analytics', base: 1200 },
    { name: 'Market Positioning Research', type: 'positioning', base: 1800 }
  ],
  buffer: [
    { name: 'Emergency Operations Fund', type: 'emergency', base: 3500 },
    { name: 'Contingency Marketing', type: 'contingency', base: 2500 },
    { name: 'Unexpected Legal Costs', type: 'legal', base: 1800 },
    { name: 'Equipment Replacement', type: 'equipment', base: 1200 },
    { name: 'Market Opportunity Fund', type: 'opportunity', base: 3000 },
    { name: 'Additional Talent Acquisition', type: 'talent', base: 5000 },
    { name: 'Technology Upgrades', type: 'tech', base: 2000 },
    { name: 'Compliance & Security', type: 'security', base: 1500 },
    { name: 'Office Expansion', type: 'expansion', base: 1000 },
    { name: 'Professional Development', type: 'training', base: 900 }
  ]
};

const expenseCategories: Record<string, ExpenseItem[]> = {};
Object.entries(baseExpenseCategories).forEach(([cat, items]) => {
  const allocation = fundAllocation[cat as keyof typeof fundAllocation].allocation;
  const baseTotal = items.reduce((sum, item) => sum + item.base * 24, 0);
  const scale = allocation / baseTotal;
  expenseCategories[cat] = items.map(item => ({
    name: item.name,
    type: item.type,
    monthly: Math.round(item.base * scale)
  }));
});

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const ExpenseTable: React.FC<ExpenseTableProps> = ({ category, title, allocation, color }) => {
  const categoryExpenses = expenseCategories[category as keyof typeof expenseCategories] || [];
  const monthlyTotal = categoryExpenses.reduce((sum, expense) => sum + expense.monthly, 0);
  const totalBudget = monthlyTotal * 24;
  const budgetUtilization = (totalBudget / allocation) * 100;

  const exportToCSV = (): void => {
    const headers = ['Expense Category', 'Type', ...months, 'Total'];
    const rows = categoryExpenses.map(expense => [
      expense.name,
      expense.type,
      ...months.map(() => expense.monthly),
      expense.monthly * 24
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${category}-expense-breakdown-24months.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold mb-2 flex items-center gap-2">
              {title}
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-5 h-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>24-month expense breakdown for {title.toLowerCase()}</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>Allocated Budget: {formatCurrency(allocation)}</div>
              <div>24-Month Projection: {formatCurrency(totalBudget)}</div>
              <div className={`font-medium ${budgetUtilization > 100 ? 'text-red-600' : budgetUtilization > 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                Budget Utilization: {budgetUtilization.toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={exportToCSV} 
              variant="outline" 
              size="sm"
              aria-label={`Export ${title} expenses to CSV`}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px] w-full overflow-x-auto">
          <div className="min-w-max">
            <Table role="table" aria-label={`${title} expense breakdown table`}>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">
                    Expense Category
                  </TableHead>
                  <TableHead className="sticky left-[200px] bg-background z-10 min-w-[100px]">
                    Type
                  </TableHead>
                  {months.map((month, index) => (
                    <TableHead key={index} className="min-w-[100px] text-center">
                      {month}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[120px] text-center font-bold">24M Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryExpenses.map((expense, expenseIndex) => (
                  <TableRow key={expenseIndex}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      <div className="flex items-center gap-2">
                        {expense.name}
                        {expense.type === 'salary' && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Employee salary expense</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="sticky left-[200px] bg-background">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                        expense.type === 'salary' ? 'bg-green-100 text-green-800' : 'bg-muted'
                      }`}>
                        {expense.type}
                      </span>
                    </TableCell>
                    {months.map((_, monthIndex) => (
                      <TableCell key={monthIndex} className="text-center">
                        {formatCurrency(expense.monthly)}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold">
                      {formatCurrency(expense.monthly * 24)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 bg-muted/20">
                  <TableCell className="sticky left-0 bg-muted/20 font-bold">
                    MONTHLY TOTAL
                  </TableCell>
                  <TableCell className="sticky left-[200px] bg-muted/20"></TableCell>
                  {months.map((_, monthIndex) => (
                    <TableCell key={monthIndex} className="text-center font-bold">
                      {formatCurrency(monthlyTotal)}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-lg">
                    {formatCurrency(totalBudget)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SummaryDashboard: React.FC = () => {
  const totalFunding = Object.values(fundAllocation).reduce((sum, item) => sum + item.allocation, 0);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {Object.entries(fundAllocation).map(([key, data]) => (
        <Card key={key} className="relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-2 h-full ${data.color}`}></div>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {data.title}
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{data.percentage}% of total $1.2M funding</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                ${(data.allocation / 1000).toFixed(0)}K
              </div>
              <div className="text-sm text-muted-foreground">
                {data.percentage}% of total funding
              </div>
              <div className="text-sm text-muted-foreground">
                Monthly: ${(data.allocation / 24 / 1000).toFixed(1)}K
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const FiveYearTabs: React.FC = () => {
  const [scenario, setScenario] = useState<number>(200);
  const [view, setView] = useState<'month' | 'year'>('month');
  const [subTab, setSubTab] = useState<string>('revenue');
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div className="flex gap-2" role="group" aria-label="Transaction scenario selection">
          {revenueScenarios.map(opt => (
            <Button 
              key={opt.value} 
              variant={scenario === opt.value ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setScenario(opt.value)}
              aria-pressed={scenario === opt.value}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto" role="group" aria-label="View selection">
          <Button 
            variant={view === 'month' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('month')}
            aria-pressed={view === 'month'}
          >
            Monthly
          </Button>
          <Button 
            variant={view === 'year' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setView('year')}
            aria-pressed={view === 'year'}
          >
            Yearly
          </Button>
        </div>
      </div>
      <Tabs value={subTab} onValueChange={setSubTab} className="mb-4">
        <TabsList className="flex gap-4">
          <TabsTrigger value="revenue">Revenue Table</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue">
          <RevenueTable scenario={scenario} view={view} />
        </TabsContent>
        <TabsContent value="assumptions">
          <AssumptionsCards scenario={scenario} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ForecastPage: React.FC = () => {
  const [mainTab, setMainTab] = useState<string>('allocation');
  const [activeTab, setActiveTab] = useState<string>('ops');
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Tabs value={mainTab} onValueChange={setMainTab} className="mb-8">
            <TabsList className="flex gap-4 w-full">
              <TabsTrigger value="allocation">NexSq Fund Allocation</TabsTrigger>
              <TabsTrigger value="fiveyear">Five Years Project</TabsTrigger>
            </TabsList>
            <TabsContent value="allocation">
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">NexSq Fund Allocation</h1>
                <p className="text-lg text-muted-foreground mb-4">24-Month Detailed Expense Breakdown</p>
                <div className="text-sm text-muted-foreground">
                  Total Funding: $1.2M | 24-Month Runway Starting January 2026
                </div>
              </div>
              <SummaryDashboard />
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="ops">Operations (35%)</TabsTrigger>
                  <TabsTrigger value="market">Go to Market (40%)</TabsTrigger>
                  <TabsTrigger value="brand">Brand Positioning (15%)</TabsTrigger>
                  <TabsTrigger value="buffer">Buffer/Runway (10%)</TabsTrigger>
                </TabsList>
                <TabsContent value="ops">
                  <ExpenseTable 
                    category="ops"
                    title="Operations Expenses (Including Salaries)"
                    allocation={fundAllocation.ops.allocation}
                    color={fundAllocation.ops.color}
                  />
                </TabsContent>
                <TabsContent value="market">
                  <ExpenseTable 
                    category="market"
                    title="Go to Market Expenses"
                    allocation={fundAllocation.market.allocation}
                    color={fundAllocation.market.color}
                  />
                </TabsContent>
                <TabsContent value="brand">
                  <ExpenseTable 
                    category="brand"
                    title="Brand Positioning Expenses"
                    allocation={fundAllocation.brand.allocation}
                    color={fundAllocation.brand.color}
                  />
                </TabsContent>
                <TabsContent value="buffer">
                  <ExpenseTable 
                    category="buffer"
                    title="Buffer/Runway Expenses"
                    allocation={fundAllocation.buffer.allocation}
                    color={fundAllocation.buffer.color}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="fiveyear">
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2">Five Years Project</h1>
                <p className="text-lg text-muted-foreground mb-4">60-Month Revenue Projection by Driver</p>
                <div className="text-sm text-muted-foreground">
                  Revenue forecast based on your business model and growth assumptions
                </div>
              </div>
              <FiveYearTabs />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ForecastPage;
