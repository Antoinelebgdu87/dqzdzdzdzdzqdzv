import "./global.css";

import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import Shop from "./pages/Shop";
import Placeholder from "./pages/Placeholder";
import Quests from "./pages/Quests";
import Profile from "./pages/Profile";
import Transactions from "./pages/Transactions";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminPanel from "./pages/AdminPanel";
import GiftCard from "./pages/GiftCard";
import AdminRoles from "./pages/AdminRoles";
import PrivateRoute from "@/components/PrivateRoute";
import { AuthProvider } from "@/context/AuthProvider";
import { ProfileProvider } from "@/context/ProfileProvider";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <ProfileProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Index />} />
                <Route element={<PrivateRoute />}>
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/rotcoins" element={<Shop />} />
                  <Route path="/quests" element={<Quests />} />
                  <Route path="/quetes" element={<Quests />} />
                  <Route path="/gift-card" element={<GiftCard />} />
                </Route>
                <Route path="/profile" element={<Profile />} />
                <Route element={<PrivateRoute />}>
                  <Route path="/transactions" element={<Transactions />} />
                  <Route
                    path="/tickets"
                    element={<Placeholder title="Tickets support" />}
                  />
                  <Route path="/messages" element={<Messages />} />
                </Route>
                <Route path="/admin" element={<PrivateRoute />}>
                  <Route index element={<AdminPanel />} />
                </Route>
                <Route path="/admin-roles" element={<PrivateRoute />}>
                  <Route index element={<AdminRoles />} />
                </Route>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              </Routes>
            </BrowserRouter>
          </ProfileProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

const _container = document.getElementById("root")!;
const _win: any = window as any;
if (!_win.__app_root) {
  _win.__app_root = createRoot(_container);
}
_win.__app_root.render(<App />);
