import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import POS from "@/pages/pos";
import Finance from "@/pages/finance";
import Sales from "@/pages/sales";
import Contacts from "@/pages/contacts";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import PaymentMethods from "@/pages/payment-methods";
import ReferenceTables from "@/pages/reference-tables";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ManagerOnboarding from "@/pages/manager-onboarding";
import Users from "@/pages/users";
import Profile from "@/pages/profile";
import CashHistory from "@/pages/cash-history";
import FiscalConfig from "@/pages/fiscal-config";
import FiscalCentralPage from "@/pages/fiscal-central";
import FiscalDocuments from "@/pages/fiscal-documents";
import Notifications from "@/pages/notifications";
import { CertificateConfig } from "@/pages/certificate-config";
import SequentialNumberingConfig from "@/pages/sequential-numbering-config";
import { Loader2 } from "lucide-react";

function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route path="/access">
        <PublicRoute component={Register} />
      </Route>
      <Route path="/forgot-password">
        <PublicRoute component={ForgotPassword} />
      </Route>
      <Route path="/register">
        <Redirect to="/access" />
      </Route>
      <Route path="/manager-onboarding">
        <PublicRoute component={ManagerOnboarding} />
      </Route>
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/inventory">
        <ProtectedRoute component={Inventory} />
      </Route>
      <Route path="/pos">
        <ProtectedRoute component={POS} />
      </Route>
      <Route path="/finance">
        <ProtectedRoute component={Finance} />
      </Route>
      <Route path="/sales">
        <ProtectedRoute component={Sales} />
      </Route>
      <Route path="/contacts">
        <ProtectedRoute component={Contacts} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/payment-methods">
        <ProtectedRoute component={PaymentMethods} />
      </Route>
      <Route path="/tables">
        <ProtectedRoute component={ReferenceTables} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>
      <Route path="/cash-history">
        <ProtectedRoute component={CashHistory} />
      </Route>
      <Route path="/fiscal-config">
        <ProtectedRoute component={FiscalConfig} />
      </Route>
      <Route path="/fiscal-documents">
        <ProtectedRoute component={FiscalDocuments} />
      </Route>
      <Route path="/fiscal-central">
        <ProtectedRoute component={FiscalCentralPage} />
      </Route>
      <Route path="/notifications">
        <ProtectedRoute component={Notifications} />
      </Route>
      <Route path="/nfe-emissao">
        <Redirect to="/fiscal-documents" />
      </Route>
      <Route path="/nfe-historico">
        <Redirect to="/fiscal-central" />
      </Route>
      <Route path="/carta-correcao">
        <Redirect to="/fiscal-central" />
      </Route>
      <Route path="/sefaz">
        <Redirect to="/fiscal-central" />
      </Route>
      <Route path="/certificates">
        <ProtectedRoute component={CertificateConfig} />
      </Route>
      <Route path="/sequential-numbering">
        <ProtectedRoute component={SequentialNumberingConfig} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

