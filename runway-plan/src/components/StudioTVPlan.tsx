import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StaffMember {
  role: string;
  count: number;
  monthlySalary: number;
  annualSalary: number;
  responsibilities: string;
}

interface SetupCost {
  category: string;
  item: string;
  cost: number;
  notes: string;
}

export const StudioTVPlan = () => {
  const studioStaff: StaffMember[] = [
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

  const setupCosts: SetupCost[] = [
    {
      category: "Studio Space",
      item: "Studio Lease/Setup (3 months)",
      cost: 12000,
      notes: "Compact studio space with green screen corner"
    },
    {
      category: "Video Equipment",
      item: "Cameras (2x 4K)",
      cost: 6000,
      notes: "Mid-range 4K cameras with basic lenses"
    },
    {
      category: "Video Equipment",
      item: "Lighting Kit",
      cost: 3000,
      notes: "LED panel lights with stands"
    },
    {
      category: "Audio Equipment",
      item: "Microphones & Audio Interface",
      cost: 2500,
      notes: "USB mics, wireless lavalier, basic mixer"
    },
    {
      category: "Audio Equipment",
      item: "Acoustic Treatment",
      cost: 1500,
      notes: "Foam panels, portable booth setup"
    },
    {
      category: "Post-Production",
      item: "Editing Workstation",
      cost: 4000,
      notes: "1 high-performance computer"
    },
    {
      category: "Post-Production",
      item: "Software Licenses (Annual)",
      cost: 2000,
      notes: "Essential editing and graphics tools"
    },
    {
      category: "Studio Setup",
      item: "Set Design & Props",
      cost: 3000,
      notes: "Basic professional set, furniture, branding"
    },
    {
      category: "Streaming",
      item: "Streaming Equipment",
      cost: 2000,
      notes: "Basic encoder and streaming setup"
    },
    {
      category: "Storage",
      item: "Storage & Backup",
      cost: 1500,
      notes: "External drives, cloud storage subscription"
    },
  ];

  const totalMonthlyStaffCost = studioStaff.reduce((sum, staff) => sum + (staff.monthlySalary * staff.count), 0);
  const totalAnnualStaffCost = studioStaff.reduce((sum, staff) => sum + (staff.annualSalary * staff.count), 0);
  const totalSetupCost = setupCosts.reduce((sum, cost) => sum + cost.cost, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Studio-TV Lean Team (Phase 1)</CardTitle>
              <CardDescription>
                Minimal viable team for 1Studio-TV and Podcast production - expands in Year 3
              </CardDescription>
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
                  ${totalMonthlyStaffCost.toLocaleString()}/mo
                </TableCell>
                <TableCell colSpan={2} className="text-right font-bold text-lg">
                  ${totalAnnualStaffCost.toLocaleString()}/year
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Lean Studio Setup & Equipment Costs</CardTitle>
          <CardDescription>
            Essential one-time investment for lean startup studio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Cost (USD)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setupCosts.map((cost, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{cost.category}</TableCell>
                  <TableCell>{cost.item}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${cost.cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cost.notes}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-primary/10">
                <TableCell colSpan={2} className="font-bold text-lg">
                  TOTAL SETUP INVESTMENT
                </TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">
                  ${totalSetupCost.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  One-time cost (Q4 2025 - Q1 2026)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-lg">Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Operating Cost</p>
                <p className="text-2xl font-bold">${totalMonthlyStaffCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Operating Cost</p>
                <p className="text-2xl font-bold">${totalAnnualStaffCost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Initial Setup Investment</p>
                <p className="text-2xl font-bold text-primary">${totalSetupCost.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
