import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface IncomeStatementProps {
  data: {
    year: number;
    revenue: number;
    expenses: number;
    netIncome: number;
    cashFlow: number;
    capitalInjection: number;
  }[];
}

export const IncomeStatement = ({ data }: IncomeStatementProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5-Year Income Statement</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line Item</TableHead>
              {data.map((row) => (
                <TableHead key={row.year} className="text-right">Year {row.year}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold">Revenue</TableCell>
              {data.map((row) => (
                <TableCell key={row.year} className="text-right text-success">
                  ${row.revenue.toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">Operating Expenses</TableCell>
              {data.map((row) => (
                <TableCell key={row.year} className="text-right text-destructive">
                  ${row.expenses.toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold">Net Income / (Loss)</TableCell>
              {data.map((row) => (
                <TableCell 
                  key={row.year} 
                  className={`text-right font-bold ${row.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  ${row.netIncome.toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableCell className="font-semibold">Capital Injection</TableCell>
              {data.map((row) => (
                <TableCell key={row.year} className="text-right text-primary font-medium">
                  {row.capitalInjection > 0 ? `$${row.capitalInjection.toLocaleString()}` : '-'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold text-lg">Cumulative Cash Position</TableCell>
              {data.map((row) => (
                <TableCell 
                  key={row.year} 
                  className={`text-right font-bold text-lg ${row.cashFlow >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  ${row.cashFlow.toLocaleString()}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
