import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ShowProvider } from "@/contexts/ShowContext";

// Pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import MyStore from "./pages/MyStore";
import Square from "./pages/Square";
import Wallet from "./pages/Wallet";
import Studio from "./pages/Studio";
import Studio2 from "./pages/studio2";
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
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Careers from "./pages/Careers";
import Developers from "./pages/Developers";
import EmailConfirmed from "./pages/EmailConfirmed";
import SendBulkResetEmails from "./pages/SendBulkResetEmails";
import CreateStore from "./pages/CreateStore";
import ShippingPartnerPage from "./pages/ShippingPartnerPage";
import ChannelPage from "./pages/ChannelPage";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSummary from "./pages/OrderSummary";
import OrderSummaryFailed from "./pages/OrderSummaryFailed";
import HashtagPage from "./pages/Hashtag";
import SavedPostsPage from "./pages/SavedPosts";
import WalletTopupResult from "./pages/WalletTopupResult";
import UploadReels from "./pages/UploadReels";
import RecordReel from "./pages/RecordReel";
import LiveStream from "./pages/LiveStream2";
import StudioSettings from "./pages/StudioSettings";
import ForgotPassword from "./pages/ForgotPassword";
import GroupDetails from "./pages/groups/[groupId]";
import StorePage from "./pages/store/[store_id]";
import ProductPage from "./pages/product/[product_id]";
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
import ForecastPage from './pages/admin/ForecastPage';
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

const App = () => {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setFadeOut(true), 1500);
    const timer2 = setTimeout(() => setLoading(false), 2700);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <>
      {loading && <LoadingOverlay fadeOut={fadeOut} />}
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <ShowProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/:username" element={<Profile />} />
                    <Route path="/profile/edit" element={<EditProfile />} />
                    <Route path="/my-store" element={<MyStore />} />
                    <Route path="/create-store" element={<CreateStore />} />
                    <Route path="/square" element={<Square />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/studio" element={<Studio />} />
                    <Route path="/studio2" element={<Studio2 />} />
                    <Route path="/studio/reel/:id" element={<ReelViewPage />} />
                    <Route path="/post/:id" element={<PostViewPage />} />
                    <Route path="/studio/upload" element={<UploadReels />} />
                    <Route path="/studio/record" element={<RecordReel />} />
                    <Route path="/studio/live" element={<LiveStream />} />
                    <Route path="/studio/settings" element={<StudioSettings />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/messages/:conversationId" element={<Messages />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/groups" element={<Groups />} />
                    <Route path="/groups/:groupId" element={<GroupDetails />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/bookmarks" element={<Bookmarks />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/email-confirmed" element={<EmailConfirmed />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/about-onepager" element={<AboutOnePager />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/cookies" element={<Cookies />} />
                    <Route path="/careers" element={<Careers />} />
                    <Route path="/developers" element={<Developers />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/store/:store_id" element={<StorePage />} />
                    <Route path="/product/:product_id" element={<ProductPage />} />
                    <Route path="/hashtag/:tag" element={<HashtagPage />} />
                    <Route path="/user-management" element={<UserManagement />} />
                    <Route path="/admin/content" element={<ContentModeration />} />
                    <Route path="/admin/settings" element={<SystemSettings />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/send-bulk-reset-emails" element={<SendBulkResetEmails />} />
                    <Route path="/shipping-partner/:partnerCode" element={<ShippingPartnerPage />} />
                    <Route path="/1voiceadmin" element={<OneVoiceAdmin />} />
                    <Route path="/admin" element={<AdminLayout />}>
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
                      <Route path="forecast" element={<ForecastPage />} />
                    </Route>
                    <Route path="/order-summary" element={<OrderSummaryFailed />} />
                    <Route path="/order-summary/:orderId" element={<OrderSummary />} />
                    <Route path="/orders" element={<ManageOrders storeCurrency="ZAR" />} />
                    <Route path="/saved-posts" element={<SavedPostsPage />} />
                    <Route path="/studio/:channelId" element={<ChannelPage />} />
                    <Route path="/events/settings/:eventId" element={<EventSettingsPage />} />
                    <Route path="/admin" element={<AdminRedirect />} />
                    <Route path="/wallet-topup-result" element={<WalletTopupResult />} />
                    <Route path="/stream/preview/:streamId" element={<StreamEndPreviewWrapper />} />
                    <Route path="/stream-end-preview/:streamId" element={<StreamEndPreviewWrapper />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </ShowProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </>
  );
};

// Wrapper to extract state for StreamEndPreview
function StreamEndPreviewWrapper() {
  const location = useLocation();
  const { streamId } = useParams();
  const videoUrl = location.state?.videoUrl || "";
  return <StreamEndPreview streamId={streamId!} videoUrl={videoUrl} />;
}

export default App;
