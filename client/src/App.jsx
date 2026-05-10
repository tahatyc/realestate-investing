import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import DealTriage from './pages/DealTriage.jsx';
import Overview from './pages/Overview.jsx';
import StrategyView from './pages/StrategyView.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Neighborhoods from './pages/Neighborhoods.jsx';
import MetricsGuide from './pages/MetricsGuide.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/triage" element={<DealTriage />} />
        <Route path="/metrics-guide" element={<MetricsGuide />} />
        <Route path="/strategy/:name" element={<StrategyView />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/neighborhoods" element={<Neighborhoods />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
