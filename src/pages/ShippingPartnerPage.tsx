import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { shippingPartners } from '@/utils/shippingPartners';

const ShippingPartnerPage = () => (
  <div className="min-h-screen bg-gray-50 transition-colors dark:bg-[#1a1a1a]">
    <Header />
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Marketplace delivery</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Carrier credentials are managed by NexSq and must never be entered in the browser.
          Live quotes are available at checkout for South African domestic and Nigeria routes.
        </p>
      </div>

      <Card className="space-y-4 p-6 dark:bg-[#161616]">
        <h2 className="text-lg font-semibold">Supported live services</h2>
        {shippingPartners.filter(partner => ['courierguy', 'terminalafrica'].includes(partner.code)).map(partner => (
          <div key={partner.code} className="border-b pb-4 last:border-0 last:pb-0 dark:border-gray-700">
            <h3 className="font-medium">{partner.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{partner.description}</p>
            {partner.docs && (
              <a className="mt-1 inline-block text-sm text-blue-600 underline" href={partner.docs} target="_blank" rel="noopener noreferrer">
                Carrier documentation
              </a>
            )}
          </div>
        ))}
      </Card>

      <Card className="p-6 dark:bg-[#161616]">
        <h2 className="text-lg font-semibold">Seller setup</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Add your pickup address and contact details in Store Settings, and enter parcel measurements
          for each physical product. Buyers will see a live quote during checkout. After payment, the
          seller can book the shipment from Manage Orders.
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Live rates and booking remain unavailable until the platform carrier credentials are
          configured on the backend service.
        </p>
      </Card>
    </main>
  </div>
);

export default ShippingPartnerPage;
