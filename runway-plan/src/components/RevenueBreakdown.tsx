import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RevenueStream {
  source: string;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  year5: number;
}

interface RevenueBreakdownProps {
  data: RevenueStream[];
}

export const RevenueBreakdown = ({ data }: RevenueBreakdownProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Breakdown by Source</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revenue Stream</TableHead>
              <TableHead className="text-right">Year 1</TableHead>
              <TableHead className="text-right">Year 2</TableHead>
              <TableHead className="text-right">Year 3</TableHead>
              <TableHead className="text-right">Year 4</TableHead>
              <TableHead className="text-right">Year 5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.source}>
                <TableCell className="font-medium">{row.source}</TableCell>
                <TableCell className="text-right">${row.year1.toLocaleString()}</TableCell>
                <TableCell className="text-right">${row.year2.toLocaleString()}</TableCell>
                <TableCell className="text-right">${row.year3.toLocaleString()}</TableCell>
                <TableCell className="text-right">${row.year4.toLocaleString()}</TableCell>
                <TableCell className="text-right">${row.year5.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
