
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Users, Code, Palette, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Careers = () => {
  const navigate = useNavigate();

  const positions = [
    {
      title: "Full-Stack Developer",
      department: "Engineering",
      type: "Full-time",
      location: "Remote",
      description: "Join our engineering team to build the next generation of social media features.",
      icon: <Code className="h-6 w-6" />
    },
    {
      title: "UX/UI Designer",
      department: "Design",
      type: "Full-time", 
      location: "Remote",
      description: "Create beautiful and intuitive user experiences that delight our global community.",
      icon: <Palette className="h-6 w-6" />
    },
    {
      title: "Community Manager",
      department: "Marketing",
      type: "Full-time",
      location: "Remote",
      description: "Build and nurture our growing community of creators and entrepreneurs.",
      icon: <MessageSquare className="h-6 w-6" />
    },
    {
      title: "Product Manager",
      department: "Product",
      type: "Full-time",
      location: "Remote",
      description: "Drive product strategy and lead cross-functional teams to deliver amazing features.",
      icon: <Users className="h-6 w-6" />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto p-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/auth')}
          className="mb-6 flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Join Our Team
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Help us build the future of social media and creator economy. We're looking for passionate individuals who want to make a difference.
          </p>
        </div>

        <div className="grid gap-6 mb-8">
          {positions.map((position, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="text-blue-600 dark:text-blue-400 mt-1">
                  {position.icon}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {position.title}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{position.type}</span>
                      <span>•</span>
                      <span>{position.location}</span>
                    </div>
                  </div>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">
                    {position.department}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {position.description}
                  </p>
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    Apply Now
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Don't See Your Role?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We're always looking for talented individuals to join our team. Send us your resume and tell us how you'd like to contribute to 1VoiceSquare.
          </p>
          <Button 
            variant="outline"
            onClick={() => window.location.href = 'mailto:careers@1voicesquare.com'}
          >
            Contact Us
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Careers;
