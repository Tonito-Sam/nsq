
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Tag, Package } from 'lucide-react';

export const StoreSidebar = () => {
  const featuredProducts = [
    {
      id: 1,
      name: 'Premium Course',
      price: '$99',
      rating: 4.8,
      image: '/placeholder.svg'
    },
    {
      id: 2,
      name: 'Digital Art Pack',
      price: '$29',
      rating: 4.9,
      image: '/placeholder.svg'
    }
  ];

  const categories = [
    { name: 'Digital Products', count: 45 },
    { name: 'Courses', count: 23 },
    { name: 'Templates', count: 67 },
    { name: 'Graphics', count: 34 }
  ];

  return (
    <div className="space-y-6">
      {/* Featured Products */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Featured Products
          </h3>
          
          <div className="space-y-3">
            {featuredProducts.map((product) => (
              <div key={product.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {product.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-green-600">{product.price}</span>
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-gray-500">{product.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            View All Featured
          </Button>
        </div>
      </Card>

      {/* Categories */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </h3>
          
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {category.count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Trending Sales */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Trending Sales
          </h3>
          
          <div className="space-y-3">
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                $2,453
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                This Week
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  156
                </div>
                <div className="text-xs text-gray-500">
                  Orders
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  4.8
                </div>
                <div className="text-xs text-gray-500">
                  Rating
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Store Tips */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Store Tips
          </h3>
          
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Optimize Your Listings
              </p>
              <p>Use high-quality images and detailed descriptions to increase sales.</p>
            </div>
            
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                Engage with Customers
              </p>
              <p>Respond quickly to messages and reviews to build trust.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
