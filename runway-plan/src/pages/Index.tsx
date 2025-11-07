import { useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { MetricsCards } from "@/components/MetricsCards";
import { ProjectionTable } from "@/components/ProjectionTable";
import { RevenueBreakdown } from "@/components/RevenueBreakdown";
import { ChartsSection } from "@/components/ChartsSection";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { InvestorDashboard } from "@/components/InvestorDashboard";
import { InvestorMetrics } from "@/components/InvestorMetrics";
import { ExpenseBreakdown } from "@/components/ExpenseBreakdown";
import { IncomeStatement } from "@/components/IncomeStatement";
import { DetailedExpenseTable } from "@/components/DetailedExpenseTable";
import { Timeline } from "@/components/Timeline";
import { InvestorOverview } from "@/components/InvestorOverview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [scenario, setScenario] = useState<"conservative" | "base" | "optimistic">("base");
  const [investmentAmount, setInvestmentAmount] = useState(1500000);
  const [equityOffered, setEquityOffered] = useState(20);
  
  const [assumptions, setAssumptions] = useState({
    // Team costs (annual)
    backendDevSalary: 20000,
    mobileDevSalary: 20000,
    designerSalary: 20000,
    marketingSalary: 20000,
    supportSalary: 10000,

    // Studio-TV team costs (annual)
    leadHostSalary: 16800,
    coHostSalary: 12000,
    videoProducerSalary: 14400,
    avTechSalary: 12000,

    // Infrastructure (monthly)
    serverCost: 300,
    storageCost: 200,
    toolsCost: 150,
    internetCost: 100,

    // Office & Admin
    propertyCost: 150000, // One-time
    utilitiesCost: 200,
    officeCost: 150,

    // Marketing (monthly)
    digitalAdsCost: 500,
    eventsCost: 500,
    miscCost: 300,

    // Revenue assumptions
    commissionRate: 1, // percent
    subscriptionPrice: 4.99,
    initialUsers: 5000, // starting users at Year 2 launch
    monthlyGrowthRate: 25, // percent per month
    avgTransactionValue: 50,
    transactionsPerUser: 3,
  });

  const updateAssumption = (key: string, value: number) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  };

  // Get growth rate (use assumptions.monthlyGrowthRate as provided)
  const getGrowthRate = () => {
    return assumptions.monthlyGrowthRate; // percent per month
  };

  // Calculate projections
  const calculateProjections = () => {
    const teamCostYearly = assumptions.backendDevSalary + assumptions.mobileDevSalary + 
      assumptions.designerSalary + assumptions.marketingSalary + assumptions.supportSalary;
    
    const studioTVCostYearly = assumptions.leadHostSalary + assumptions.coHostSalary + 
      assumptions.videoProducerSalary + assumptions.avTechSalary;
    
    const infraCostYearly = (assumptions.serverCost + assumptions.storageCost + assumptions.toolsCost + assumptions.internetCost) * 12;
    const officeCostYearly = (assumptions.utilitiesCost + assumptions.officeCost) * 12;
    const marketingCostYearly = (assumptions.digitalAdsCost + assumptions.eventsCost + assumptions.miscCost) * 12;

    const projections = [];
    let cumulativeCashFlow = 0;
    
    const growthRate = getGrowthRate();
    
    for (let year = 1; year <= 5; year++) {
      // Capital injections
      let capitalInjection = 0;
      if (year === 1) {
        capitalInjection = 375000 + 375000; // Initial 25% + second injection Q3/Q4 2026 = $750k
      } else if (year === 2) {
        capitalInjection = 500000; // Third injection Q2 2027
      }
      
      // Expenses grow modestly each year (10% annual increase for inflation/scale)
      const yearMultiplier = 1 + ((year - 1) * 0.10);
      
      // Year 1 includes property cost as a one-time expense
      let expenses = Math.round((teamCostYearly + studioTVCostYearly + infraCostYearly + officeCostYearly + marketingCostYearly) * yearMultiplier);
      if (year === 1) {
        expenses += assumptions.propertyCost; // Add property cost in Year 1
      }
      // Year 2 includes office expansion costs (West Africa + East Africa/North Africa/Middle-East)
      if (year === 2) {
        expenses += 300000; // $150k per office × 2 offices
      }
      
      // Revenue calculation - YEAR 1 = $0 (Building Phase)
      let revenue = 0;
      if (year === 1) {
        revenue = 0; // No revenue in Year 1 - building phase
      } else if (year >= 2) {
        // Start generating revenue from Year 2
        // Use monthly growth compounding from Year 2 launch
        const monthsSinceLaunch = (year - 2) * 12; // 0 for Year 2
        const monthlyGrowth = getGrowthRate() / 100;
        const users = Math.round(assumptions.initialUsers * Math.pow(1 + monthlyGrowth, monthsSinceLaunch));

        // Transaction commission revenue (annual)
        const monthlyTransactions = users * assumptions.transactionsPerUser;
        const annualTransactions = monthlyTransactions * 12;
        const gmv = annualTransactions * assumptions.avgTransactionValue;
        const commissionRevenue = gmv * (assumptions.commissionRate / 100);

        // Subscription revenue (starts year 2)
        let subscriptionRevenue = 0;
        if (year >= 2) {
          const stores = Math.min(50 * (year - 2 + 1), 500); // ramp stores conservatively
          subscriptionRevenue = Math.round(stores * assumptions.subscriptionPrice * 12);
        }

        // Ads revenue (starts year 2, scales with user base)
        const adsRevenue = Math.round(users * 0.5 * 12); // $0.50 per user annually

        revenue = Math.round(commissionRevenue + subscriptionRevenue + adsRevenue);
      }
      
      const netIncome = revenue - expenses;
      cumulativeCashFlow += netIncome + capitalInjection;
      
      projections.push({
        year,
        revenue,
        expenses,
        netIncome,
        cashFlow: cumulativeCashFlow,
        capitalInjection,
      });
    }
    
    return projections;
  };

  const calculateRevenueBreakdown = () => {
    const breakdown = [
      { source: "Transaction Commissions", year1: 0, year2: 0, year3: 0, year4: 0, year5: 0 },
      { source: "Store Subscriptions", year1: 0, year2: 0, year3: 0, year4: 0, year5: 0 },
      { source: "Advertising", year1: 0, year2: 0, year3: 0, year4: 0, year5: 0 },
    ];

    const growthRate = getGrowthRate(); // Use scenario-based growth rate

    for (let year = 1; year <= 5; year++) {
      if (year >= 2) {
        const users = assumptions.initialUsers * Math.pow(1 + growthRate / 100, (year - 2) * 12);
        const transactions = users * assumptions.transactionsPerUser * 12;
        const gmv = transactions * assumptions.avgTransactionValue;
        const commissionRevenue = Math.round(gmv * (assumptions.commissionRate / 100));
        
        breakdown[0][`year${year}` as keyof typeof breakdown[0]] = commissionRevenue as never;
        
        if (year >= 3) {
          const stores = Math.min(200 * (year - 2), 1000);
          const subscriptionRevenue = Math.round(stores * assumptions.subscriptionPrice * 12);
          breakdown[1][`year${year}` as keyof typeof breakdown[1]] = subscriptionRevenue as never;
        }
        
        const adsRevenue = Math.round(2000 * 12 * Math.pow(1.5, year - 2));
        breakdown[2][`year${year}` as keyof typeof breakdown[2]] = adsRevenue as never;
      }
    }

    return breakdown;
  };

  const projectionData = calculateProjections();
  const revenueBreakdown = calculateRevenueBreakdown();

  // Calculate metrics
  const totalRevenue = projectionData.reduce((sum, year) => sum + year.revenue, 0);
  const totalExpenses = projectionData.reduce((sum, year) => sum + year.expenses, 0);
  const netCashFlow = totalRevenue - totalExpenses;
  
  // Calculate runway (months until funding needed)
  const monthlyBurn = projectionData[0].expenses / 12;
  const runwayMonths = Math.round(investmentAmount / monthlyBurn);
  
  // Find break-even year
  const breakEvenYear = projectionData.findIndex(year => year.cashFlow >= 0) + 1 || 5;

  // Calculate investor metrics
  const year5Revenue = projectionData[4].revenue;
  const totalMarketingSpend = projectionData.reduce((sum, year) => sum + (assumptions.digitalAdsCost + assumptions.eventsCost) * 12, 0);
  const totalUsers = assumptions.initialUsers * Math.pow(1 + getGrowthRate() / 100, 3 * 12); // Year 5 users
  const cac = totalUsers > 0 ? totalMarketingSpend / totalUsers : 0;
  const avgRevenuePerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;
  const customerLifetimeMonths = 24; // Assume 24 month average lifetime
  const ltv = avgRevenuePerUser * (customerLifetimeMonths / 60); // 60 months = 5 years
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  
  // Burn multiple = Net Burn / Net New ARR
  const netBurnYear2 = Math.abs(projectionData[1].netIncome);
  const arrGrowthYear2 = projectionData[1].revenue;
  const burnMultiple = arrGrowthYear2 > 0 ? netBurnYear2 / arrGrowthYear2 : 0;
  
  const monthlyRecurringRevenue = year5Revenue / 12;

  // Prepare chart data
  const chartData = projectionData.map(p => ({
    year: `Year ${p.year}`,
    revenue: p.revenue,
    expenses: p.expenses,
    cashFlow: p.cashFlow,
  }));

  const revenueChartData = [
    { name: "Commissions", year2: revenueBreakdown[0].year2, year3: revenueBreakdown[0].year3, year4: revenueBreakdown[0].year4, year5: revenueBreakdown[0].year5 },
    { name: "Subscriptions", year2: revenueBreakdown[1].year2, year3: revenueBreakdown[1].year3, year4: revenueBreakdown[1].year4, year5: revenueBreakdown[1].year5 },
    { name: "Advertising", year2: revenueBreakdown[2].year2, year3: revenueBreakdown[2].year3, year4: revenueBreakdown[2].year4, year5: revenueBreakdown[2].year5 },
  ];

  const handleExport = () => {
    toast.success("Export feature coming soon! This will generate an Excel file with all projections.");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Nexsq Financial Forecast</h1>
            <p className="text-muted-foreground mt-2">
              5-Year projection for 1Wallet, Square, Studio & 1Studio-TV including Ads and Subscriptions
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Total Investment: $1.5M (20% equity @ 12% ROI) | Minimum Start: $375K (25%) = $150K property + $225K ops (24-month runway)
            </p>
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Scenario Selector */}
        <ScenarioSelector scenario={scenario} onScenarioChange={setScenario} />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8 mt-8">
            <InvestorOverview 
              investmentAmount={investmentAmount}
              equityOffered={equityOffered}
              year5Revenue={year5Revenue}
            />
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-8 mt-8">

        {/* Timeline */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Project Timeline</h2>
          <Timeline />
        </div>

        {/* Investor Dashboard */}
        <InvestorDashboard 
          investmentAmount={investmentAmount}
          equityOffered={equityOffered}
          year5Revenue={year5Revenue}
          onInvestmentChange={setInvestmentAmount}
          onEquityChange={setEquityOffered}
        />

        {/* Investor Metrics */}
        <InvestorMetrics 
          cac={cac}
          ltv={ltv}
          ltvCacRatio={ltvCacRatio}
          burnMultiple={burnMultiple}
          monthlyRecurringRevenue={monthlyRecurringRevenue}
        />

        {/* Key Metrics */}
        <MetricsCards
          totalRevenue={totalRevenue}
          totalExpenses={totalExpenses}
          netCashFlow={netCashFlow}
          runwayMonths={runwayMonths}
          breakEvenYear={breakEvenYear}
        />

        {/* Assumptions */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Assumptions</h2>
          <AssumptionsPanel assumptions={assumptions} onUpdate={updateAssumption} />
        </div>

        {/* Charts */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Visualizations</h2>
          <ChartsSection projectionData={chartData} revenueBreakdownData={revenueChartData} />
        </div>

        {/* Income Statement */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Income Statement</h2>
          <IncomeStatement data={projectionData} />
        </div>

        {/* Detailed Expense Breakdown */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Expense Breakdown by Category</h2>
          <DetailedExpenseTable assumptions={assumptions} />
        </div>

        {/* Projection Table */}
        <ProjectionTable data={projectionData} />

        {/* Revenue Breakdown */}
        <RevenueBreakdown data={revenueBreakdown} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
