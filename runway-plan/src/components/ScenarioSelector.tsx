import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ScenarioSelectorProps {
  scenario: "conservative" | "base" | "optimistic";
  onScenarioChange: (scenario: "conservative" | "base" | "optimistic") => void;
}

export const ScenarioSelector = ({ scenario, onScenarioChange }: ScenarioSelectorProps) => {
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Growth Scenario</h3>
            <span className="text-sm text-muted-foreground">
              Adjust projections based on market conditions
            </span>
          </div>
          <Tabs value={scenario} onValueChange={(val) => onScenarioChange(val as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conservative">Conservative</TabsTrigger>
              <TabsTrigger value="base">Base Case</TabsTrigger>
              <TabsTrigger value="optimistic">Optimistic</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className={`p-3 rounded-lg ${scenario === 'conservative' ? 'bg-muted' : 'opacity-50'}`}>
              <div className="font-medium">Conservative</div>
              <div className="text-xs text-muted-foreground mt-1">15% monthly growth</div>
            </div>
            <div className={`p-3 rounded-lg ${scenario === 'base' ? 'bg-muted' : 'opacity-50'}`}>
              <div className="font-medium">Base Case</div>
              <div className="text-xs text-muted-foreground mt-1">25% monthly growth</div>
            </div>
            <div className={`p-3 rounded-lg ${scenario === 'optimistic' ? 'bg-muted' : 'opacity-50'}`}>
              <div className="font-medium">Optimistic</div>
              <div className="text-xs text-muted-foreground mt-1">35% monthly growth</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
