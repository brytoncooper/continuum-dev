import { Navigate, Route, Routes } from 'react-router-dom';
import { DocsPage } from './docs/docs-page';
import { LandingPage } from './landing/landing-page';
import { LiveAiPage } from './live/live-ai-page';
import { PlaygroundPage } from './playground/playground-page';
import { PrimitivePage } from './showcase/primitive-page';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/playground" element={<PlaygroundPage />} />
      <Route path="/starter-kit" element={<PrimitivePage />} />
      <Route path="/live-ai" element={<LiveAiPage />} />
      <Route path="/showcase" element={<Navigate to="/starter-kit" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
