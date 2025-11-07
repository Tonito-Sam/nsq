import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Rocket, TrendingUp } from "lucide-react";

export const Timeline = () => {
  const milestones = [
    {
      date: "December 1, 2025",
      title: "First Capital Injection",
      description: "$375,000 received (25% of total investment)",
      icon: DollarSign,
      color: "text-primary",
    },
    {
      date: "January 1st, 2026",
      title: "Operations Launch",
      description: "Full operations kickoff - products already developed (1Wallet, Square, Studio)",
      icon: Rocket,
      color: "text-success",
    },
    {
      date: "February - Q3 2026",
      title: "Product Launch",
      description: "Monthly rollout: 1Wallet & Square platform goes live",
      icon: TrendingUp,
      color: "text-warning",
    },
    {
      date: "Q3 & Q4 2026",
      title: "Second Capital Injection",
      description: "$375,000 for scaling operations and aggressive marketing",
      icon: DollarSign,
      color: "text-primary",
    },
    {
      date: "Q1 - Q3 2027",
      title: "West Africa Expansion",
      description: "Operational office opens in Nigeria ($150k budget)",
      icon: Rocket,
      color: "text-success",
    },
    {
      date: "Q2 2027",
      title: "Third Capital Injection",
      description: "$500,000 for West Africa & East Africa market expansion",
      icon: DollarSign,
      color: "text-primary",
    },
    {
      date: "Q4 2027",
      title: "East Africa / North Africa / Middle-East Expansion",
      description: "Operational office opens ($150k budget)",
      icon: TrendingUp,
      color: "text-warning",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Project Timeline & Milestones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {milestones.map((milestone, index) => {
            const Icon = milestone.icon;
            return (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`rounded-full p-2 bg-muted ${milestone.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < milestones.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {milestone.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{milestone.title}</h3>
                  <p className="text-muted-foreground">{milestone.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
