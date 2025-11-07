import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Activity } from "lucide-react";

interface InvestorMetricsProps {
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  burnMultiple: number;
  monthlyRecurringRevenue: number;
}

export const InvestorMetrics = ({ cac, ltv, ltvCacRatio, burnMultiple, monthlyRecurringRevenue }: InvestorMetricsProps) => {
  const getMetricColor = (value: number, metric: string) => {
    if (metric === 'ltv-cac') {
      return value >= 3 ? 'text-success' : value >= 2 ? 'text-warning' : 'text-destructive';
    }
    if (metric === 'burn-multiple') {
      return value <= 1.5 ? 'text-success' : value <= 2.5 ? 'text-warning' : 'text-destructive';
    }
    return 'text-foreground';
  };

  const metrics = [
    {
      title: "CAC",
      description: "Customer Acquisition Cost",
      value: `$${cac.toFixed(2)}`,
      icon: Users,
      trend: "Target: <$50",
      color: cac < 50 ? 'text-success' : 'text-warning'
    },
    {
      title: "LTV",
      description: "Customer Lifetime Value",
      value: `$${ltv.toFixed(2)}`,
      icon: DollarSign,
      trend: "Target: >$150",
      color: ltv > 150 ? 'text-success' : 'text-warning'
    },
    {
      title: "LTV:CAC Ratio",
      description: "Value to cost ratio",
      value: `${ltvCacRatio.toFixed(1)}x`,
      icon: TrendingUp,
      trend: "Target: >3x (Healthy)",
      color: getMetricColor(ltvCacRatio, 'ltv-cac')
    },
    {
      title: "Burn Multiple",
      description: "Capital efficiency metric",
      value: burnMultiple.toFixed(1),
      icon: Activity,
      trend: "Target: <1.5x (Efficient)",
      color: getMetricColor(burnMultiple, 'burn-multiple')
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Key Investor Metrics</CardTitle>
        <CardDescription>Critical SaaS & Marketplace metrics for fundraising</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{metric.title}</span>
                </div>
                <div className={`text-2xl font-bold ${metric.color}`}>
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{metric.trend}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-4 rounded-lg bg-muted">
          <div className="text-sm font-medium mb-1">Monthly Recurring Revenue (MRR)</div>
          <div className="text-2xl font-bold text-primary">${monthlyRecurringRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Growing revenue stream from subscriptions</p>
        </div>
      </CardContent>
    </Card>
  );
};
