import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ShowProvider } from "@/contexts/ShowContext";
import RouteTracker from '@/components/RouteTracker';

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Campaigns from './pages/Campaigns';
import CampaignCreate from './pages/CampaignCreate';
import MyStore from "./pages/MyStore";
import Square from "./pages/Square";
import Wallet from "./pages/Wallet";
import Studio from "./pages/Studio";
import ReelViewPage from "./pages/ReelViewPage";
import PostViewPage from "./pages/PostViewPage";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Groups from "./pages/Groups";
import Events from "./pages/Events";
import Bookmarks from "./pages/Bookmarks";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import UserManagement from "./pages/UserManagement";
import Analytics from "./pages/Analytics";
import ContentModeration from "./pages/ContentModeration";
import SystemSettings from "./pages/SystemSettings";
import Users from "./pages/Users";
import ResetPassword from "./pages/ResetPassword";
import About from "./pages/About";
import AboutOnePager from "./pages/AboutOnePager";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Cookies from "./pages/Cookies";
import Careers from "./pages/Careers";
import Developers from "./pages/Developers";
import EmailConfirmed from "./pages/EmailConfirmed";
import SendBulkResetEmails from "./pages/SendBulkResetEmails";
import CreateStore from "./pages/CreateStore";
import ShippingPartnerPage from "./pages/ShippingPartnerPage";
import ChannelPage from "./pages/ChannelPage";
import StudioChannelPage from "./components/studio/ChannelPage";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSummary from "./pages/OrderSummary";
import OrderSummaryFailed from "./pages/OrderSummaryFailed";
import HashtagPage from "./pages/Hashtag";
import SavedPostsPage from "./pages/SavedPosts";
import WalletTopupResult from "./pages/WalletTopupResult";
import UploadReels from "./pages/UploadReels";
import RecordReel from "./pages/RecordReel";
import RecordVideo from "./pages/RecordVideo";
import LiveStream from "./pages/LiveStream2";
import StudioSettings from "./pages/StudioSettings";
import ForgotPassword from "./pages/ForgotPassword";
import GroupDetails from "./pages/groups/[groupId]";
import StorePage from "./pages/store/[store_id]";
import ProductPage from "./pages/product/[product_id]";
import Deals from './pages/Deals';
import Sales from './pages/Sales';
import { ManageOrders } from './components/ManageOrders';
import OneVoiceAdmin from './pages/1voiceadmin';
import EventSettingsPage from './pages/events/settings/[eventId]';
import OverviewPage from './pages/admin/OverviewPage';
import UsersPage from './pages/admin/UsersPage';
import StudiosPage from './pages/admin/StudiosPage';
import StoresPage from './pages/admin/StoresPage';
import ReportsPage from './pages/admin/ReportsPage';
import WithdrawalsPage from './pages/admin/WithdrawalsPage';
import TransfersPage from './pages/admin/TransfersPage';
import TicketsPage from './pages/admin/TicketsPage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import RevenuePage from './pages/admin/RevenuePage';
import SoundBankManager from './pages/admin/SoundBankManager';
import AdminLayout from './pages/admin/AdminLayout';
import AdminRedirect from './pages/admin/AdminRedirect';
import { StreamEndPreview } from "./pages/StreamEndPreview";

// ✅ Optimized QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

// CSS for animation
const style = `
@keyframes pulseLogo {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes loadBar {
  0% { width: 0%; }
  100% { width: 100%; }
}
`;

const LoadingOverlay = ({ fadeOut }: { fadeOut: boolean }) => (
  <>
    <style>{style}</style>
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 1.2s ease-in-out",
        background: "linear-gradient(to bottom, #18181b, #121214ff)",
        flexDirection: "column",
      }}
    >
      <img
        src="/lovable-uploads/9de584d8-1087-4e32-8971-c629229627e3.png"
        alt="NexSq Logo"
        style={{
          width: 96,
          height: 96,
          objectFit: "contain",
          animation: "pulseLogo 2s infinite",
        }}
      />
      <div
        style={{
          marginTop: 16,
          width: 120,
          height: 4,
          backgroundColor: "#333",
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "#6366f1",
            animation: "loadBar 2.7s linear forwards",
          }}
        ></div>
      </div>
    </div>
  </>
);

// Removed SessionValidator and validateSession usage due to missing property

function StreamEndPreviewWrapper() {
  const location = useLocation();
  const { streamId } = useParams();
  const videoUrl = location.state?.videoUrl || "";
  return <StreamEndPreview streamId={streamId!} videoUrl={videoUrl} />;
}

// Wrapper component for ManageOrders that provides the required storeCurrency prop
function ManageOrdersWithCurrency() {
  // In a real app, you would fetch this from:
  // 1. Store context/state
  // 2. User's profile/settings
  // 3. Store API call
  // For now, using a sensible default - you should replace this with actual logic
  const storeCurrency = "USD"; // Default to USD
  
  // You might want to implement logic like:
  // const { currentStore } = useStoreContext();
  // const storeCurrency = currentStore?.currency || "USD";
  
  // Or fetch from localStorage:
  // useEffect(() => {
  //   const storeData = localStorage.getItem('currentStore');
  //   if (storeData) {
  //     const store = JSON.parse(storeData);
  //     setStoreCurrency(store.currency || "USD");
  //   }
  // }, []);
  
  return <ManageOrders storeCurrency={storeCurrency} />;
}

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setIsLoading(false), 1200);
    }, 2700);
    return () => clearTimeout(timer);
  }, []);

  console.log("App is rendering");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="dark" storageKey="nexsq-theme">
          <ShowProvider>
            <TooltipProvider>
              <BrowserRouter>
                <RouteTracker />
                {isLoading && <LoadingOverlay fadeOut={fadeOut} />}
                <div style={{ display: isLoading ? "none" : "block" }}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/email-confirmed" element={<EmailConfirmed />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/about-one-pager" element={<AboutOnePager />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/cookies" element={<Cookies />} />
                    <Route path="/careers" element={<Careers />} />
                    <Route path="/developers" element={<Developers />} />
                    
                    {/* Protected Routes */}
                    <Route path="/" element={<Index />} />
                    {/* Dynamic profile route for other users */}
                    <Route path="/profile/:username" element={<Profile />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="/edit-profile" element={<EditProfile />} />
                    <Route path="/square" element={<Square />} />
                    <Route path="/studio" element={<Studio />} />
                    <Route path="/studio/upload" element={<UploadReels />} />
                    <Route path="/studio/record" element={<RecordReel />} />
                    <Route path="/studio/record-preview" element={<RecordVideo />} />
                    <Route path="/studio/settings" element={<StudioSettings />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/wallet/topup-result" element={<WalletTopupResult />} />
                    <Route path="/my-store" element={<MyStore />} />
                    <Route path="/create-store" element={<CreateStore />} />
                    <Route path="/store/:store_id" element={<StorePage />} />
                    <Route path="/product/:product_id" element={<ProductPage />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/campaigns/create" element={<CampaignCreate />} />
                    <Route path="/reels/upload" element={<UploadReels />} />
                    <Route path="/reels/record" element={<RecordReel />} />
                    <Route path="/video/record" element={<RecordVideo />} />
                    <Route path="/live" element={<LiveStream />} />
                    <Route path="/stream-end/:streamId" element={<StreamEndPreviewWrapper />} />
                    <Route path="/reel/:reelId" element={<ReelViewPage />} />
                    <Route path="/post/:postId" element={<PostViewPage />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/groups" element={<Groups />} />
                    <Route path="/groups/:groupId" element={<GroupDetails />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/settings/:eventId" element={<EventSettingsPage />} />
                    <Route path="/bookmarks" element={<Bookmarks />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/channel/:channelId" element={<ChannelPage />} />
                    <Route path="/studio/channel/:id" element={<StudioChannelPage />} />
                    <Route path="/studio/channel/user/:id" element={<StudioChannelPage />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order/summary" element={<OrderSummary />} />
                    <Route path="/order/failed" element={<OrderSummaryFailed />} />
                    <Route path="/hashtag/:tag" element={<HashtagPage />} />
                    <Route path="/saved" element={<SavedPostsPage />} />
                    <Route path="/shipping-partners" element={<ShippingPartnerPage />} />
                    <Route path="/deals" element={<Deals />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/manage-orders" element={<ManageOrdersWithCurrency />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminRedirect />} />
                    <Route path="/admin/*" element={<AdminLayout />}>
                      <Route path="overview" element={<OverviewPage />} />
                      <Route path="users" element={<UsersPage />} />
                      <Route path="studios" element={<StudiosPage />} />
                      <Route path="stores" element={<StoresPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="withdrawals" element={<WithdrawalsPage />} />
                      <Route path="transfers" element={<TransfersPage />} />
                      <Route path="tickets" element={<TicketsPage />} />
                      <Route path="announcements" element={<AnnouncementsPage />} />
                      <Route path="revenue" element={<RevenuePage />} />
                      <Route path="soundbank" element={<SoundBankManager />} />
                      <Route path="user-management" element={<UserManagement />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="content-moderation" element={<ContentModeration />} />
                      <Route path="system-settings" element={<SystemSettings />} />
                    </Route>
                    
                    {/* Other Admin */}
                    <Route path="/1voiceadmin" element={<OneVoiceAdmin />} />
                    <Route path="/send-bulk-reset-emails" element={<SendBulkResetEmails />} />
                    
                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
                <Toaster />
                <Sonner />
              </BrowserRouter>
            </TooltipProvider>
          </ShowProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;