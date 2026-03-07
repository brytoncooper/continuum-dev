import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './landing/landing-page';
import { PlaygroundPage } from './playground/playground-page';
import { PrimitivePage } from './showcase/primitive-page';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/playground" element={<PlaygroundPage />} />
      <Route path="/showcase" element={<PrimitivePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
