import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Assumptions {
  backendDevSalary: number;
  mobileDevSalary: number;
  designerSalary: number;
  marketingSalary: number;
  supportSalary: number;
  leadHostSalary: number;
  coHostSalary: number;
  videoProducerSalary: number;
  avTechSalary: number;
  serverCost: number;
  storageCost: number;
  toolsCost: number;
  internetCost: number;
  propertyCost: number;
  utilitiesCost: number;
  officeCost: number;
  digitalAdsCost: number;
  eventsCost: number;
  miscCost: number;
}

interface DetailedExpenseTableProps {
  assumptions: Assumptions;
}

export const DetailedExpenseTable = ({ assumptions }: DetailedExpenseTableProps) => {
  const calculateYearlyExpense = (annualCost: number, year: number) => {
    const multiplier = 1 + ((year - 1) * 0.10);
    return Math.round(annualCost * multiplier);
  };

  const calculateYearlyMonthly = (monthlyCost: number, year: number) => {
    const multiplier = 1 + ((year - 1) * 0.10);
    return Math.round(monthlyCost * 12 * multiplier);
  };

  const teamExpenses = [
    { name: "Backend Engineer", annual: assumptions.backendDevSalary },
    { name: "Mobile Developer", annual: assumptions.mobileDevSalary },
    { name: "UI/UX Designer", annual: assumptions.designerSalary },
    { name: "Marketing Lead", annual: assumptions.marketingSalary },
    { name: "Customer Support", annual: assumptions.supportSalary },
  ];

  const studioExpenses = [
    { name: "Lead Host", annual: assumptions.leadHostSalary },
    { name: "Co-Host", annual: assumptions.coHostSalary },
    { name: "Video Producer", annual: assumptions.videoProducerSalary },
    { name: "Audio/Visual Tech", annual: assumptions.avTechSalary },
  ];

  const infraExpenses = [
    { name: "Servers & Hosting", monthly: assumptions.serverCost },
    { name: "Storage & CDN", monthly: assumptions.storageCost },
    { name: "Dev Tools & Licenses", monthly: assumptions.toolsCost },
    { name: "Internet & Connectivity", monthly: assumptions.internetCost },
  ];

  const officeExpenses = [
    { name: "Utilities", monthly: assumptions.utilitiesCost },
    { name: "Office Supplies & Admin", monthly: assumptions.officeCost },
  ];

  const marketingExpenses = [
    { name: "Digital Ads", monthly: assumptions.digitalAdsCost },
    { name: "Events & Influencers", monthly: assumptions.eventsCost },
    { name: "Misc Operations", monthly: assumptions.miscCost },
  ];

  const getYearTotals = (year: number) => {
    const teamTotal = teamExpenses.reduce((sum, exp) => sum + calculateYearlyExpense(exp.annual, year), 0);
    const studioTotal = studioExpenses.reduce((sum, exp) => sum + calculateYearlyExpense(exp.annual, year), 0);
    const infraTotal = infraExpenses.reduce((sum, exp) => sum + calculateYearlyMonthly(exp.monthly, year), 0);
    const officeTotal = officeExpenses.reduce((sum, exp) => sum + calculateYearlyMonthly(exp.monthly, year), 0);
    const marketingTotal = marketingExpenses.reduce((sum, exp) => sum + calculateYearlyMonthly(exp.monthly, year), 0);
    const propertyInYear1 = year === 1 ? assumptions.propertyCost : 0;
    return teamTotal + studioTotal + infraTotal + officeTotal + marketingTotal + propertyInYear1;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Annual Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense Category</TableHead>
              <TableHead className="text-right">Year 1</TableHead>
              <TableHead className="text-right">Year 2</TableHead>
              <TableHead className="text-right">Year 3</TableHead>
              <TableHead className="text-right">Year 4</TableHead>
              <TableHead className="text-right">Year 5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30">
              <TableCell className="font-bold" colSpan={6}>Core Team Salaries</TableCell>
            </TableRow>
            {teamExpenses.map((exp) => (
              <TableRow key={exp.name}>
                <TableCell className="pl-6">{exp.name}</TableCell>
                {[1, 2, 3, 4, 5].map(year => (
                  <TableCell key={year} className="text-right">
                    ${calculateYearlyExpense(exp.annual, year).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            
            <TableRow className="bg-muted/30">
              <TableCell className="font-bold" colSpan={6}>Studio-TV Team Salaries</TableCell>
            </TableRow>
            {studioExpenses.map((exp) => (
              <TableRow key={exp.name}>
                <TableCell className="pl-6">{exp.name}</TableCell>
                {[1, 2, 3, 4, 5].map(year => (
                  <TableCell key={year} className="text-right">
                    ${calculateYearlyExpense(exp.annual, year).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            
            <TableRow className="bg-muted/30">
              <TableCell className="font-bold" colSpan={6}>Infrastructure (Annual)</TableCell>
            </TableRow>
            {infraExpenses.map((exp) => (
              <TableRow key={exp.name}>
                <TableCell className="pl-6">{exp.name}</TableCell>
                {[1, 2, 3, 4, 5].map(year => (
                  <TableCell key={year} className="text-right">
                    ${calculateYearlyMonthly(exp.monthly, year).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            
            <TableRow className="bg-muted/30">
              <TableCell className="font-bold" colSpan={6}>Office & Admin (Annual)</TableCell>
            </TableRow>
            {officeExpenses.map((exp) => (
              <TableRow key={exp.name}>
                <TableCell className="pl-6">{exp.name}</TableCell>
                {[1, 2, 3, 4, 5].map(year => (
                  <TableCell key={year} className="text-right">
                    ${calculateYearlyMonthly(exp.monthly, year).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="pl-6 font-semibold">Property Purchase (Year 1 only)</TableCell>
              <TableCell className="text-right text-primary font-semibold">
                ${assumptions.propertyCost.toLocaleString()}
              </TableCell>
              {[2, 3, 4, 5].map(year => (
                <TableCell key={year} className="text-right text-muted-foreground">-</TableCell>
              ))}
            </TableRow>
            
            <TableRow className="bg-muted/30">
              <TableCell className="font-bold" colSpan={6}>Marketing & Operations (Annual)</TableCell>
            </TableRow>
            {marketingExpenses.map((exp) => (
              <TableRow key={exp.name}>
                <TableCell className="pl-6">{exp.name}</TableCell>
                {[1, 2, 3, 4, 5].map(year => (
                  <TableCell key={year} className="text-right">
                    ${calculateYearlyMonthly(exp.monthly, year).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            
            <TableRow className="border-t-2 font-bold">
              <TableCell>Total Annual Expenses</TableCell>
              {[1, 2, 3, 4, 5].map(year => (
                <TableCell key={year} className="text-right text-destructive font-bold">
                  ${getYearTotals(year).toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
