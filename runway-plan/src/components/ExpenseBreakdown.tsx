import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExpenseCategory {
  category: string;
  role: string;
  count: number | string;
  monthlyUSD: number;
  annualUSD: number;
  notes: string;
}

interface StudioStaffMember {
  role: string;
  count: number;
  monthlySalary: number;
  annualSalary: number;
  responsibilities: string;
}

export const ExpenseBreakdown = () => {
  const teamExpenses: ExpenseCategory[] = [
    { category: "Technical / Product", role: "Principal Engineer (Lead Dev + Full-stack + UX)", count: 1, monthlyUSD: 0, annualUSD: 0, notes: "Founder equity - role splits in Year 3" },
    { category: "Technical / Product", role: "DevOps / Cloud Engineer", count: "1 (PT)", monthlyUSD: 1500, annualUSD: 18000, notes: "Contract-based" },
    { category: "Technical / Product", role: "QA / Tester", count: "1 (PT)", monthlyUSD: 800, annualUSD: 9600, notes: "Intern or contract" },
    { category: "Marketing / Growth", role: "Growth Marketer", count: 1, monthlyUSD: 2000, annualUSD: 24000, notes: "Performance-based + commissions" },
    { category: "Marketing / Growth", role: "Social Media / Content Manager", count: 1, monthlyUSD: 1200, annualUSD: 14400, notes: "Part-time flexible role" },
    { category: "Business / Operations", role: "COO / Operations Manager", count: 1, monthlyUSD: 3000, annualUSD: 36000, notes: "Admin & finance" },
    { category: "Business / Operations", role: "Customer Support", count: "1 (PT)", monthlyUSD: 800, annualUSD: 9600, notes: "Entry-level part-time" },
    { category: "Advisory / Finance", role: "CFO/Finance (Consultant)", count: "1 (PT)", monthlyUSD: 600, annualUSD: 7200, notes: "Consultant basis" },
  ];

  const studioStaff: StudioStaffMember[] = [
    {
      role: "Lead Host (TV + Podcast)",
      count: 1,
      monthlySalary: 2500,
      annualSalary: 30000,
      responsibilities: "Main host for TV shows and podcast, brand ambassador"
    },
    {
      role: "Co-Host/Content Creator",
      count: 1,
      monthlySalary: 1800,
      annualSalary: 21600,
      responsibilities: "Co-hosting, interviews, field reporting, content creation"
    },
    {
      role: "Video Producer/Editor",
      count: 1,
      monthlySalary: 2200,
      annualSalary: 26400,
      responsibilities: "Production, editing, post-production, multi-camera operation"
    },
    {
      role: "Audio/Visual Technician",
      count: 1,
      monthlySalary: 1800,
      annualSalary: 21600,
      responsibilities: "Audio mixing, camera operation, lighting, live streaming"
    },
  ];

  const infrastructureExpenses = [
    { item: "MVP Stage (current)", monthlyUSD: 100, annualUSD: 1200, notes: "Minimal usage" },
    { item: "Early Traction (1k-10k users)", monthlyUSD: 550, annualUSD: 6600, notes: "As you scale" },
    { item: "Scaling (10k-100k users)", monthlyUSD: 2000, annualUSD: 24000, notes: "Optimized caching" },
  ];

  const marketingExpenses = [
    { item: "Paid Ads (Google, Meta, TikTok)", monthlyUSD: 3500, annualUSD: 42000, notes: "Controlled experiments" },
    { item: "Influencer/Partnership Campaigns", monthlyUSD: 1500, annualUSD: 18000, notes: "Short-term boosts" },
    { item: "Branding, Content, Media", monthlyUSD: 1250, annualUSD: 15000, notes: "Graphics, videos, blogs" },
    { item: "Analytics & Tools", monthlyUSD: 250, annualUSD: 3000, notes: "Mixpanel, GA4, etc." },
  ];

  const totalTeamMonthly = teamExpenses.reduce((sum, item) => sum + item.monthlyUSD, 0);
  const totalTeamAnnual = teamExpenses.reduce((sum, item) => sum + item.annualUSD, 0);
  
  const totalStudioMonthly = studioStaff.reduce((sum, staff) => sum + (staff.monthlySalary * staff.count), 0);
  const totalStudioAnnual = studioStaff.reduce((sum, staff) => sum + (staff.annualSalary * staff.count), 0);
  
  const totalInfraMonthly = 550; // Using early traction estimate
  const totalInfraAnnual = 6600;
  
  const totalMarketingMonthly = marketingExpenses.reduce((sum, item) => sum + item.monthlyUSD, 0);
  const totalMarketingAnnual = marketingExpenses.reduce((sum, item) => sum + item.annualUSD, 0);
  
  const miscMonthly = 650; // Legal, admin, tools
  const miscAnnual = 7800;
  
  const grandTotalMonthly = totalTeamMonthly + totalInfraMonthly + totalMarketingMonthly + miscMonthly;
  const grandTotalAnnual = totalTeamAnnual + totalInfraAnnual + totalMarketingAnnual + miscAnnual;

  return (
    <div className="space-y-6">
      {/* Team Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Lean Startup Team Structure (Phase 1: Year 1-2)</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Core team: 5-6 people lean startup model. Roles expand in Year 3.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Count</TableHead>
                <TableHead className="text-right">Monthly (USD)</TableHead>
                <TableHead className="text-right">Annual (USD)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamExpenses.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.category}</TableCell>
                  <TableCell>{item.role}</TableCell>
                  <TableCell className="text-center">{item.count}</TableCell>
                  <TableCell className="text-right">
                    ${item.monthlyUSD.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.annualUSD.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={3}>Team Subtotal</TableCell>
                <TableCell className="text-right">${totalTeamMonthly.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totalTeamAnnual.toLocaleString()}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Studio-TV Team */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Studio-TV Lean Team (Phase 1)</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Minimal viable team for 1Studio-TV and Podcast production - expands in Year 3
              </p>
            </div>
            <Badge variant="default" className="text-lg px-4 py-2">
              Start Date: January 1, 2026
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Count</TableHead>
                <TableHead className="text-right">Monthly Salary</TableHead>
                <TableHead className="text-right">Annual Salary</TableHead>
                <TableHead className="text-right">Total Annual</TableHead>
                <TableHead>Responsibilities</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studioStaff.map((staff, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{staff.role}</TableCell>
                  <TableCell className="text-center">{staff.count}</TableCell>
                  <TableCell className="text-right">${staff.monthlySalary.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${staff.annualSalary.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${(staff.annualSalary * staff.count).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{staff.responsibilities}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="font-bold text-lg">
                  TOTAL STUDIO-TV STAFF COSTS
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  ${totalStudioMonthly.toLocaleString()}/mo
                </TableCell>
                <TableCell colSpan={2} className="text-right font-bold text-lg">
                  ${totalStudioAnnual.toLocaleString()}/year
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Infrastructure Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Server & Infrastructure Costs</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            AWS / Supabase / Firebase / Render - costs grow with usage
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scale</TableHead>
                <TableHead className="text-right">Monthly (USD)</TableHead>
                <TableHead className="text-right">Annual (USD)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {infrastructureExpenses.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell className="text-right">${item.monthlyUSD.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${item.annualUSD.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Marketing Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Marketing & Growth Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead className="text-right">Monthly (USD)</TableHead>
                <TableHead className="text-right">Annual (USD)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketingExpenses.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.item}</TableCell>
                  <TableCell className="text-right">${item.monthlyUSD.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${item.annualUSD.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.notes}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Marketing Subtotal</TableCell>
                <TableCell className="text-right">${totalMarketingMonthly.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totalMarketingAnnual.toLocaleString()}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Total Burn Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle>Combined Early Burn Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Monthly Burn (USD)</TableHead>
                <TableHead className="text-right">Annual Burn (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Team Salaries (Platform + Studio-TV)</TableCell>
                <TableCell className="text-right">${(totalTeamMonthly + totalStudioMonthly).toLocaleString()}</TableCell>
                <TableCell className="text-right">${(totalTeamAnnual + totalStudioAnnual).toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Infrastructure / DevOps</TableCell>
                <TableCell className="text-right">${totalInfraMonthly.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totalInfraAnnual.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Marketing</TableCell>
                <TableCell className="text-right">${totalMarketingMonthly.toLocaleString()}</TableCell>
                <TableCell className="text-right">${totalMarketingAnnual.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Miscellaneous (legal, admin, tools)</TableCell>
                <TableCell className="text-right">${miscMonthly.toLocaleString()}</TableCell>
                <TableCell className="text-right">${miscAnnual.toLocaleString()}</TableCell>
              </TableRow>
              <TableRow className="font-bold text-lg bg-primary/10">
                <TableCell>TOTAL MONTHLY BURN</TableCell>
                <TableCell className="text-right">${(totalTeamMonthly + totalStudioMonthly + totalInfraMonthly + totalMarketingMonthly + miscMonthly).toLocaleString()}</TableCell>
                <TableCell className="text-right">${(totalTeamAnnual + totalStudioAnnual + totalInfraAnnual + totalMarketingAnnual + miscAnnual).toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Runway Calculation:</strong> With $1.5M investment @ ${(totalTeamMonthly + totalStudioMonthly + totalInfraMonthly + totalMarketingMonthly + miscMonthly).toLocaleString()}/month = {Math.floor(1500000 / (totalTeamMonthly + totalStudioMonthly + totalInfraMonthly + totalMarketingMonthly + miscMonthly))} months runway
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Minimum to Start (1/3):</strong> $500,000 = {Math.floor(500000 / (totalTeamMonthly + totalStudioMonthly + totalInfraMonthly + totalMarketingMonthly + miscMonthly))} months runway to kick off by January 1st, 2026
            </p>
            <p className="text-sm text-muted-foreground mt-2 italic">
              <strong>Note:</strong> All team members (Platform + Studio-TV) resume work on January 1, 2026
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
