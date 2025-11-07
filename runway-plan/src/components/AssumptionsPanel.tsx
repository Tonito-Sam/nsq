import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AssumptionsPanelProps {
  assumptions: any;
  onUpdate: (key: string, value: number) => void;
}

export const AssumptionsPanel = ({ assumptions, onUpdate }: AssumptionsPanelProps) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Team Costs</CardTitle>
          <CardDescription>Annual salary costs in USD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backendDev">Backend Engineer</Label>
            <Input
              id="backendDev"
              type="number"
              value={assumptions.backendDevSalary}
              onChange={(e) => onUpdate("backendDevSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobileDev">Mobile Developer</Label>
            <Input
              id="mobileDev"
              type="number"
              value={assumptions.mobileDevSalary}
              onChange={(e) => onUpdate("mobileDevSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="designer">UI/UX Designer</Label>
            <Input
              id="designer"
              type="number"
              value={assumptions.designerSalary}
              onChange={(e) => onUpdate("designerSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing">Marketing Lead</Label>
            <Input
              id="marketing"
              type="number"
              value={assumptions.marketingSalary}
              onChange={(e) => onUpdate("marketingSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support">Customer Support</Label>
            <Input
              id="support"
              type="number"
              value={assumptions.supportSalary}
              onChange={(e) => onUpdate("supportSalary", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Studio-TV Team</CardTitle>
          <CardDescription>Annual salary costs in USD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leadHost">Lead Host (TV + Podcast)</Label>
            <Input
              id="leadHost"
              type="number"
              value={assumptions.leadHostSalary}
              onChange={(e) => onUpdate("leadHostSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coHost">Co-Host/Content Creator</Label>
            <Input
              id="coHost"
              type="number"
              value={assumptions.coHostSalary}
              onChange={(e) => onUpdate("coHostSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="videoProducer">Video Producer/Editor</Label>
            <Input
              id="videoProducer"
              type="number"
              value={assumptions.videoProducerSalary}
              onChange={(e) => onUpdate("videoProducerSalary", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avTech">Audio/Visual Technician</Label>
            <Input
              id="avTech"
              type="number"
              value={assumptions.avTechSalary}
              onChange={(e) => onUpdate("avTechSalary", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Infrastructure</CardTitle>
          <CardDescription>Monthly costs in USD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="servers">Servers & Hosting</Label>
            <Input
              id="servers"
              type="number"
              value={assumptions.serverCost}
              onChange={(e) => onUpdate("serverCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storage">Storage & CDN</Label>
            <Input
              id="storage"
              type="number"
              value={assumptions.storageCost}
              onChange={(e) => onUpdate("storageCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tools">Dev Tools & Licenses</Label>
            <Input
              id="tools"
              type="number"
              value={assumptions.toolsCost}
              onChange={(e) => onUpdate("toolsCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internet">Internet & Connectivity</Label>
            <Input
              id="internet"
              type="number"
              value={assumptions.internetCost}
              onChange={(e) => onUpdate("internetCost", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Office & Admin</CardTitle>
          <CardDescription>Monthly & one-time costs in USD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="property">Property Purchase (One-time)</Label>
            <Input
              id="property"
              type="number"
              value={assumptions.propertyCost}
              onChange={(e) => onUpdate("propertyCost", Number(e.target.value))}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Paid upfront from initial investment</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="utilities">Utilities (Monthly)</Label>
            <Input
              id="utilities"
              type="number"
              value={assumptions.utilitiesCost}
              onChange={(e) => onUpdate("utilitiesCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="office">Office Supplies & Admin</Label>
            <Input
              id="office"
              type="number"
              value={assumptions.officeCost}
              onChange={(e) => onUpdate("officeCost", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marketing</CardTitle>
          <CardDescription>Monthly costs in USD</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="digitalAds">Digital Ads</Label>
            <Input
              id="digitalAds"
              type="number"
              value={assumptions.digitalAdsCost}
              onChange={(e) => onUpdate("digitalAdsCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="events">Events & Influencers</Label>
            <Input
              id="events"
              type="number"
              value={assumptions.eventsCost}
              onChange={(e) => onUpdate("eventsCost", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="misc">Misc Operations</Label>
            <Input
              id="misc"
              type="number"
              value={assumptions.miscCost}
              onChange={(e) => onUpdate("miscCost", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Revenue Assumptions</CardTitle>
          <CardDescription>Growth and pricing parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commission">Transaction Commission (%)</Label>
            <Input
              id="commission"
              type="number"
              step="0.1"
              value={assumptions.commissionRate}
              onChange={(e) => onUpdate("commissionRate", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subscription">Store Subscription ($/month)</Label>
            <Input
              id="subscription"
              type="number"
              step="0.01"
              value={assumptions.subscriptionPrice}
              onChange={(e) => onUpdate("subscriptionPrice", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initialUsers">Initial Active Users (Year 2)</Label>
            <Input
              id="initialUsers"
              type="number"
              value={assumptions.initialUsers}
              onChange={(e) => onUpdate("initialUsers", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="growthRate">Monthly Growth Rate (%)</Label>
            <Input
              id="growthRate"
              type="number"
              step="0.1"
              value={assumptions.monthlyGrowthRate}
              onChange={(e) => onUpdate("monthlyGrowthRate", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avgTransaction">Avg Transaction Value ($)</Label>
            <Input
              id="avgTransaction"
              type="number"
              value={assumptions.avgTransactionValue}
              onChange={(e) => onUpdate("avgTransactionValue", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionsPerUser">Transactions/User/Month</Label>
            <Input
              id="transactionsPerUser"
              type="number"
              step="0.1"
              value={assumptions.transactionsPerUser}
              onChange={(e) => onUpdate("transactionsPerUser", Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
