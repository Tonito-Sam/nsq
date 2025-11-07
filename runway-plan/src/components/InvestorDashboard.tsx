import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Percent, DollarSign, Users } from "lucide-react";

interface InvestorDashboardProps {
  investmentAmount: number;
  equityOffered: number;
  year5Revenue: number;
  onInvestmentChange: (amount: number) => void;
  onEquityChange: (equity: number) => void;
}

export const InvestorDashboard = ({ 
  investmentAmount, 
  equityOffered, 
  year5Revenue,
  onInvestmentChange,
  onEquityChange 
}: InvestorDashboardProps) => {
  
  // Valuation scenarios based on revenue multiples
  const calculateValuation = (multiple: number) => year5Revenue * multiple;
  
  const conservativeValuation = calculateValuation(3);
  const baseValuation = calculateValuation(6);
  const optimisticValuation = calculateValuation(10);
  
  const calculateROI = (valuation: number) => {
    const investorStakeValue = valuation * (equityOffered / 100);
    const roi = ((investorStakeValue - investmentAmount) / investmentAmount) * 100;
    const multiple = investorStakeValue / investmentAmount;
    return { roi, multiple, stakeValue: investorStakeValue };
  };
  
  const conservativeROI = calculateROI(conservativeValuation);
  const baseROI = calculateROI(baseValuation);
  const optimisticROI = calculateROI(optimisticValuation);

  const postMoneyValuation = investmentAmount / (equityOffered / 100);
  const minInvestmentPerInvestor = investmentAmount * 0.25;
  const maxInvestors = 4;
  const equityPerInvestor = equityOffered / maxInvestors;
  const annualROI = 12; // 12% recommended annual ROI
  const annualReturnAmount = investmentAmount * (annualROI / 100);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Investment Parameters - Seed Round
          </CardTitle>
          <CardDescription>
            Target launch: January 1st, 2026 • Can start with 1/3 of total ask ($500K minimum)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="investment">Total Investment Seeking (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="investment"
                  type="number"
                  value={investmentAmount}
                  onChange={(e) => onInvestmentChange(Number(e.target.value))}
                  className="pl-9 text-lg font-semibold"
                  step="50000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum to start: ${(investmentAmount / 3).toLocaleString()} (1/3 of total)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equity">Total Equity Offered (%)</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="equity"
                  type="number"
                  value={equityOffered}
                  onChange={(e) => onEquityChange(Number(e.target.value))}
                  className="pl-9 text-lg font-semibold"
                  step="0.5"
                  min="5"
                  max="30"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Co-ownership of {equityOffered}% of Nexsq platform
              </p>
            </div>
          </div>

          {/* Investor Structure */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Investor Structure
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Maximum investors:</span>
                <span className="font-medium">{maxInvestors} investors</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Equity per investor (if 4):</span>
                <span className="font-medium">{equityPerInvestor.toFixed(1)}% each</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min. investment per investor:</span>
                <span className="font-medium">${minInvestmentPerInvestor.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Can be 1-4 investors splitting the {equityOffered}% equity. Each investor minimum 5% equity share.
            </p>
          </div>

          {/* Post-Money Valuation */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm font-medium mb-1 text-primary">Post-Money Valuation</div>
            <div className="text-3xl font-bold">
              ${postMoneyValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on ${investmentAmount.toLocaleString()} for {equityOffered}% equity
            </p>
          </div>

          {/* ROI Terms */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Percent className="h-4 w-4" />
              Recommended ROI Terms
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Annual ROI on Capital:</span>
                <span className="font-semibold text-right">{annualROI}% per annum</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Annual Return Amount:</span>
                <span className="font-semibold text-right">${annualReturnAmount.toLocaleString()}/year</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Capital Recovery Period:</span>
                <span className="font-semibold text-right">Years 3-7</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Structure:</span>
                <span className="font-semibold text-right">Preferred returns + equity appreciation</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-background rounded text-xs text-muted-foreground">
              <strong>Investment Structure:</strong> Investors receive {annualROI}% annual return (${annualReturnAmount.toLocaleString()}/year) 
              as preferred returns until capital is recovered (typically 5-8 years). After recovery, they continue earning 
              from their {equityOffered}% equity ownership through profit distributions and exit multiples.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5-Year Exit Scenarios</CardTitle>
          <CardDescription>Projected valuations based on Year 5 revenue of ${year5Revenue.toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm font-medium text-muted-foreground mb-2">Conservative (3x Revenue)</div>
              <div className="text-2xl font-bold mb-1">
                ${conservativeValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investor Stake:</span>
                  <span className="font-medium">${conservativeROI.stakeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Multiple:</span>
                  <span className="font-bold text-warning">{conservativeROI.multiple.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI:</span>
                  <span className={conservativeROI.roi > 0 ? 'text-success' : 'text-destructive'}>
                    {conservativeROI.roi > 0 ? '+' : ''}{conservativeROI.roi.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border-2 border-primary bg-card">
              <div className="text-sm font-medium text-primary mb-2">Base Case (6x Revenue)</div>
              <div className="text-2xl font-bold mb-1">
                ${baseValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investor Stake:</span>
                  <span className="font-medium">${baseROI.stakeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Multiple:</span>
                  <span className="font-bold text-primary">{baseROI.multiple.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI:</span>
                  <span className={baseROI.roi > 0 ? 'text-success' : 'text-destructive'}>
                    {baseROI.roi > 0 ? '+' : ''}{baseROI.roi.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm font-medium text-muted-foreground mb-2">Optimistic (10x Revenue)</div>
              <div className="text-2xl font-bold mb-1">
                ${optimisticValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investor Stake:</span>
                  <span className="font-medium">${optimisticROI.stakeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Multiple:</span>
                  <span className="font-bold text-success">{optimisticROI.multiple.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI:</span>
                  <span className={optimisticROI.roi > 0 ? 'text-success' : 'text-destructive'}>
                    {optimisticROI.roi > 0 ? '+' : ''}{optimisticROI.roi.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2 text-sm">Funding Series Classification</h4>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Seed Round</span> — MVP stage with product on Google Play, 
              pre-revenue but ready to launch monetization. Investment of ${investmentAmount.toLocaleString()} 
              is typical for this stage, with option to start at ${(investmentAmount / 3).toLocaleString()} (1/3 of ask).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
