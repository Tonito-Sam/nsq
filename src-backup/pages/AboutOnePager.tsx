import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Users,
  PieChart,
  Send,
  Store,
  ShoppingBag,
  Video,
  Heart,
  MonitorPlay,
  TrendingUp,
  Zap,
  Layers,
  UsersRound,
  Rocket,
} from 'lucide-react';

const revenueData = [
  { year: '2026', revenue: 0.365 },
  { year: '2027', revenue: 1.1 },
  { year: '2028', revenue: 3.3 },
  { year: '2029', revenue: 9.9 },
  { year: '2030', revenue: 29.6 },
];

const investmentPackages = [
  {
    title: 'Lead Investor',
    amount: '$1,200,000',
    months: 6,
    shareholding: '20%',
    investors: 1,
    monthly: '$200,000',
    gradient: 'from-green-500 to-blue-500',
    icon: DollarSign,
  },
  {
    title: 'Two Investors',
    amount: '$600,000',
    months: 6,
    shareholding: '10% each',
    investors: 2,
    monthly: '$100,000',
    gradient: 'from-purple-500 to-pink-500',
    icon: Users,
  },
  {
    title: 'Three Investors',
    amount: '$400,000',
    months: 4,
    shareholding: '6.67% each',
    investors: 3,
    monthly: '$100,000',
    gradient: 'from-yellow-500 to-orange-500',
    icon: PieChart,
  },
];

const revenueDrivers = [
  { icon: Send, text: 'Transaction fee from funds transfer' },
  { icon: Store, text: 'Service fee from store' },
  { icon: ShoppingBag, text: 'Merchant fee from store owners' },
  { icon: Video, text: 'Commission from Series fees on 1Studio' },
  { icon: Heart, text: 'Commission from donation on Livestreams' },
  { icon: MonitorPlay, text: 'Ads & Fees from 1Studio TV shows' },
];

const investorBenefits = [
  { icon: TrendingUp, text: 'Equity in a fast-growing African tech startup' },
  { icon: Zap, text: 'Early entry at stable valuation' },
  { icon: Layers, text: 'Scalable, multi-platform product already built' },
  { icon: UsersRound, text: 'Proven traction with 200+ early users' },
  { icon: Rocket, text: 'Mission-driven founding team with global vision' },
];

const AboutOnePager = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const toggleExpand = (index: number) => {
    setExpanded(expanded === index ? null : index);
  };

  const handleSubmit = async () => {
    const { name, email, phone } = formData;
    if (!name || !email || !phone) {
      alert('Please fill in all fields.');
      return;
    }

    // Simple email submission using a backend API (example: /api/send-email)
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'invest@nexsq.com',
          subject: `Investment Meeting Request – ${investmentPackages[selectedPackage!].title}`,
          text: `
            Name: ${name}
            Email: ${email}
            Phone: ${phone}
            Package: ${investmentPackages[selectedPackage!].title}
          `,
        }),
      });
      alert('Your request has been sent successfully!');
      setFormData({ name: '', email: '', phone: '' });
      setSelectedPackage(null);
    } catch (error) {
      alert('Failed to send email. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#e0e7ff] to-[#f0fdfa] dark:from-[#18181b] dark:via-[#312e81] dark:to-[#0f172a] flex flex-col items-center justify-center p-8">
      <Card className="max-w-6xl w-full p-10 bg-white/90 dark:bg-[#232946] shadow-xl border-0">
        <h1 className="text-4xl font-extrabold text-center text-blue-700 dark:text-blue-300 mb-6">
          NexSq PEP One-Pager
        </h1>

        <p className="text-lg text-gray-700 dark:text-gray-200 mb-6 text-center">
          Welcome potential investors! Here's a detailed snapshot of the NexSq Private Equity Participation offer.
        </p>

        {/* Valuation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-r from-yellow-400 to-pink-500 text-white px-6 py-6 rounded-2xl shadow font-bold text-lg text-center">
            <p className="mb-2">Implied Platform Valuation</p>
            <p className="text-2xl font-extrabold">$6,000,000 USD</p>
          </div>
          <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-6 py-6 rounded-2xl shadow font-bold text-lg text-center">
            <p className="mb-2">ASK</p>
            <p className="text-2xl font-extrabold">$1,200,000 USD</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-green-400 text-white px-6 py-6 rounded-2xl shadow font-bold text-lg text-center">
            <p className="mb-2">OFFER</p>
            <p className="text-2xl font-extrabold">20% Equity</p>
          </div>
        </div>

        {/* Investment Packages */}
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-4 text-center">
          20% Equity Open – Investment Package
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {investmentPackages.map((pkg, index) => {
            const Icon = pkg.icon;
            return (
              <div
                key={index}
                className={`relative bg-gradient-to-r ${pkg.gradient} text-white p-6 rounded-2xl shadow cursor-pointer hover:scale-105 transition-transform`}
                onClick={() => toggleExpand(index)}
              >
                <div className="flex flex-col items-center text-center">
                  <Icon className="h-10 w-10 mb-2 opacity-90" />
                  <p className="text-xl font-bold">{pkg.title}</p>
                  <p className="text-2xl font-extrabold">{pkg.amount}</p>
                  <p className="mt-2 text-sm">{pkg.investors} investor(s) • {pkg.shareholding}</p>
                </div>

              <AnimatePresence>
  {expanded === index && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 bg-white text-gray-800 rounded-xl p-4 shadow-inner"
    >
      <p className="font-semibold mb-2">Fund Release Plan</p>
      <ul className="text-sm mb-3 space-y-1">
        <li>Total Months: {pkg.months}</li>
        <li>Monthly Payment: {pkg.monthly}</li>
        <li>Shareholding: {pkg.shareholding}</li>
      </ul>

      {/* Payment Timeline */}
      <div className="mb-3">
        <p className="text-sm font-semibold mb-2 text-gray-700">Payment Timeline</p>
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pkg.months }).map((_, monthIndex) => (
            <div
              key={monthIndex}
              className="flex flex-col items-center"
            >
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs">
                {monthIndex + 1}
              </div>
              {monthIndex < pkg.months - 1 && (
                <div className="w-8 h-1 bg-gray-300"></div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          Each circle represents a month of payment for this package.
        </p>
      </div>

      {/* Invest Now Button */}
      <button
        onClick={() => setSelectedPackage(index)}
        className="w-full mt-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full font-semibold shadow hover:scale-105 transition-transform"
      >
        Invest Now
      </button>
    </motion.div>
  )}
</AnimatePresence>

              </div>
            );
          })}
        </div>

        {/* Revenue Chart */}
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-4">
          Projected Platform Revenue (2026-2030)
        </h2>
        <div className="h-64 w-full bg-white dark:bg-gray-800 rounded-xl p-4 shadow mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <XAxis dataKey="year" stroke="#8884d8" />
              <YAxis tickFormatter={(value) => `$${value}M`} stroke="#8884d8" />
              <Tooltip formatter={(value) => `$${value}M`} />
              <Bar dataKey="revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Drivers */}
        <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4">Key Revenue Drivers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {revenueDrivers.map((driver, index) => {
            const Icon = driver.icon;
            return (
              <div key={index} className="flex flex-col items-center bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 shadow">
                <Icon className="h-8 w-8 text-blue-500 mb-2" />
                <p className="text-center text-sm text-gray-700 dark:text-gray-200">{driver.text}</p>
              </div>
            );
          })}
        </div>

        {/* Investor Benefits */}
        <h3 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-4">Investor Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {investorBenefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="flex flex-col items-center bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 shadow">
                <Icon className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-center text-sm text-gray-700 dark:text-gray-200">{benefit.text}</p>
              </div>
            );
          })}
        </div>

        {/* Return Button */}
        <div className="flex justify-center mt-10">
          <button
            onClick={() => navigate('/about')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow hover:scale-105 transition-transform"
          >
            Return to About
          </button>
        </div>
      </Card>

      {/* Modal Form */}
      <AnimatePresence>
        {selectedPackage !== null && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-4 text-center">
                Book a Meeting – {investmentPackages[selectedPackage].title}
              </h2>
              <form className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-2 rounded-lg shadow hover:scale-105 transition-transform"
                >
                  Submit
                </button>
              </form>
              <button
                onClick={() => setSelectedPackage(null)}
                className="mt-4 w-full text-center text-gray-500 hover:text-red-500"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AboutOnePager;
