import { SidebarLayout } from "~/page-layouts/sidebar-layout";
import { ChannelView } from "~/pages/channel/ChannelView";
import { DoneView } from "~/pages/done/DoneView";
import { SentView } from "./pages/sent/SentView";
import { InboxView } from "~/pages/inbox/InboxView";
import { LoginView } from "~/pages/login/LoginView";
import { ThreadView } from "~/pages/thread/ThreadView";
import { Route, Routes, Navigate } from "react-router-dom";
import {
  NavigateServiceInitializer,
  history,
} from "~/services/navigate.service";
import { LoadingModal } from "./dialogs/LoadingModal";
import { unstable_HistoryRouter as HistoryRouter } from "react-router-dom";
import { NotFound } from "./components/NotFound";
import { RemindersView } from "./pages/reminders/RemindersView";
import { MaintenanceView } from "./pages/maintenance/MaintenanceView";

export function AppRoutes() {
  return (
    <HistoryRouter history={history}>
      <NavigateServiceInitializer />
      <LoadingModal />

      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/maintenance" element={<MaintenanceView />} />
        <Route path="/" element={<SidebarLayout />}>
          <Route index element={<Navigate to="inbox" replace />} />
          <Route path="inbox" element={<InboxView />} />
          <Route path="done" element={<DoneView />} />
          <Route path="sent" element={<SentView />} />
          <Route path="reminders" element={<RemindersView />} />
          <Route path="channels/:channelId" element={<ChannelView />} />
          <Route path="threads/:threadId" element={<ThreadView />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HistoryRouter>
  );
}
