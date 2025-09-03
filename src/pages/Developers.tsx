
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Code, Book, Zap, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Developers = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Code className="h-8 w-8" />,
      title: "REST API",
      description: "Comprehensive API access to integrate 1VoiceSquare functionality into your applications."
    },
    {
      icon: <Book className="h-8 w-8" />,
      title: "Documentation",
      description: "Detailed guides, tutorials, and reference materials to get you started quickly."
    },
    {
      icon: <Zap className="h-8 w-8" />,
      title: "Webhooks",
      description: "Real-time notifications for events happening in your connected applications."
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Secure",
      description: "OAuth 2.0 authentication and secure endpoints to protect user data."
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
            Developer Platform
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Build amazing applications with the 1VoiceSquare API. Connect your users to our global community and creator economy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
              <div className="text-blue-600 dark:text-blue-400 mb-4 flex justify-center">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Getting Started
            </h3>
            <div className="space-y-3 text-gray-600 dark:text-gray-300">
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">1</span>
                <span>Create a developer account</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">2</span>
                <span>Register your application</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">3</span>
                <span>Get your API keys</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">4</span>
                <span>Start building!</span>
              </div>
            </div>
            <Button className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              Get API Access
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              API Endpoints
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 font-mono">
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                GET /api/v1/users
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                POST /api/v1/posts
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                GET /api/v1/stores
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                POST /api/v1/messages
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              View Documentation
            </Button>
          </Card>
        </div>

        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Need Help?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Our developer support team is here to help you build amazing integrations with 1VoiceSquare.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="outline"
              onClick={() => window.location.href = 'mailto:developers@1voicesquare.com'}
            >
              Contact Support
            </Button>
            <Button 
              onClick={() => window.location.href = 'https://discord.gg/1voicesquare'}
            >
              Join Discord
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Developers;
