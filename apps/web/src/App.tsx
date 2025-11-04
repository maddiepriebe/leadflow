import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ICPPage from './pages/icp/ICPPage';
import LeadsPage from './pages/leads/LeadsPage';
import SequencesPage from './pages/sequences/SequencesPage';
import InboxPage from './pages/inbox/InboxPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';

// ==========================================
// MAIN APP COMPONENT
// ==========================================
// Defines all routes (URLs) in the app

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LeadsPage />} />
        <Route path="/icp" element={<ICPPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/sequences" element={<SequencesPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;