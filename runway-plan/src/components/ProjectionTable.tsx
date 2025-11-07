import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface YearData {
  year: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  cashFlow: number;
  capitalInjection: number;
}

interface ProjectionTableProps {
  data: YearData[];
}

export const ProjectionTable = ({ data }: ProjectionTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>5-Year Financial Projection</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead className="text-right">Capital Injection</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net Income</TableHead>
              <TableHead className="text-right">Cumulative Cash Flow</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.year}>
                <TableCell className="font-medium">Year {row.year}</TableCell>
                <TableCell className="text-right text-primary font-medium">
                  {row.capitalInjection > 0 ? `$${row.capitalInjection.toLocaleString()}` : '-'}
                </TableCell>
                <TableCell className="text-right text-success">
                  ${row.revenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-destructive">
                  ${row.expenses.toLocaleString()}
                </TableCell>
                <TableCell className={`text-right font-semibold ${row.netIncome >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${row.netIncome.toLocaleString()}
                </TableCell>
                <TableCell className={`text-right font-semibold ${row.cashFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${row.cashFlow.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
