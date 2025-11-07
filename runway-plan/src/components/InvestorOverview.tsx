import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DollarSign, TrendingUp, Users, Target, UsersRound, Store, Wallet, ShoppingCart, Video, Radio, CreditCard, Truck, Megaphone, LineChart } from "lucide-react";

interface InvestorOverviewProps {
  investmentAmount: number;
  equityOffered: number;
  year5Revenue: number;
}

export const InvestorOverview = ({ investmentAmount, equityOffered, year5Revenue }: InvestorOverviewProps) => {
  const capitalInjectionData = [
    { phase: "Phase 1\nDec 2025", amount: 375000, color: "#10b981" },
    { phase: "Phase 2\nQ3-Q4 2026", amount: 375000, color: "#3b82f6" },
    { phase: "Phase 3\nQ2 2027", amount: 500000, color: "#8b5cf6" },
    { phase: "Phase 4\nQ1 2028", amount: 250000, color: "#f59e0b" },
  ];

  const postMoneyValuation = (investmentAmount / equityOffered) * 100;
  const annualROI = investmentAmount * 0.12;
  const baseExitValue = year5Revenue * 6;
  const investorExitValue = baseExitValue * (equityOffered / 100);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Investment Opportunity</CardTitle>
          <p className="text-muted-foreground text-lg">
            Join us in revolutionizing digital payments and commerce across Africa
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Investment</p>
                <p className="text-2xl font-bold">${(investmentAmount / 1000000).toFixed(1)}M</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-success/10 rounded-lg">
                <Target className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Equity Offered</p>
                <p className="text-2xl font-bold">{equityOffered}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual ROI</p>
                <p className="text-2xl font-bold">12%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <Users className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Investor Structure</p>
                <p className="text-2xl font-bold">1-4 Investors</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capital Injection Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Our Ask: Capital Injection Phases</CardTitle>
          <p className="text-muted-foreground">
            Phased investment approach totaling $1.75M over 27 months
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={capitalInjectionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="phase" 
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000)}K`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                contentStyle={{ borderRadius: '8px' }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {capitalInjectionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-semibold mb-2">Flexible Start Option</h4>
            <p className="text-sm text-muted-foreground">
              Can start with Phase 1 only ($375K = 25% equity) which covers $150K property purchase + $225K operations (24-month runway)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Post-Money Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              ${(postMoneyValuation / 1000000).toFixed(1)}M
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Based on {equityOffered}% equity stake
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Annual Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">
              ${(annualROI / 1000).toFixed(0)}K/year
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              12% annual preferred returns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5-Year Exit Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">
              ${(investorExitValue / 1000000).toFixed(0)}M
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Base case (6x revenue multiple)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Preferred Returns</h4>
              <p className="text-sm text-muted-foreground">
                Receive 12% annual returns ($180K/year) as preferred payments until capital recovery (typically 5-8 years)
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Equity Ownership</h4>
              <p className="text-sm text-muted-foreground">
                Continue earning from {equityOffered}% equity through profit distributions and exit appreciation after capital recovery
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-semibold mb-2">Seed Round Classification</h4>
            <p className="text-sm text-muted-foreground">
              MVP stage with products on Google Play, pre-revenue but ready to launch monetization. 
              Investment of $1.5M is typical for this stage, with option to start at $375K-$500K.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Products Ready */}
      <Card>
        <CardHeader>
          <CardTitle>Products Already Developed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UsersRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">The Community</h4>
                  <p className="text-sm text-muted-foreground">A social and professional ecosystem where users are posting, sharing, chatting, and growing while connecting with other users</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Store className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Store</h4>
                  <p className="text-sm text-muted-foreground">A store-front management tool designed for sellers on the square to manage their products, sales, customers</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Wallet className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">1Wallet</h4>
                  <p className="text-sm text-muted-foreground">Digital wallet for seamless transactions both on the store and personal account</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Square</h4>
                  <p className="text-sm text-muted-foreground">Marketplace platform connecting buyers and sellers</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Video className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Nexsq Studio</h4>
                  <p className="text-sm text-muted-foreground">Content creation and production platform</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Radio className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">1Studio</h4>
                  <p className="text-sm text-muted-foreground">Broadcasting and streaming service</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">CrossBorder Payment Gateway</h4>
                  <p className="text-sm text-muted-foreground">Partnership with Flutterwave, Paystack and PayPal</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Cross-border Logistics</h4>
                  <p className="text-sm text-muted-foreground">Partnership with Aramex</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Megaphone className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Ads System</h4>
                  <p className="text-sm text-muted-foreground">Integrated advertising platform for revenue generation</p>
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <LineChart className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Analytics Layer</h4>
                  <p className="text-sm text-muted-foreground">Comprehensive analytics and insights platform</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            All products ready - funding will launch full operations, marketing, and expansion
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
