import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import { RoleProvider } from './context/RoleContext.jsx';
import ForwardAdvice from './screens/ForwardAdvice/index.jsx';
import HodApproval from './screens/HodApproval/index.jsx';
import PaymentAdvice from './screens/PaymentAdvice/index.jsx';
import PaymentRegister from './screens/PaymentRegister/index.jsx';
import ProcessPayment from './screens/ProcessPayment/index.jsx';
import RvInbox from './screens/RvInbox/index.jsx';

export default function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Header />
        <main className="page">
          <Routes>
            <Route path="/" element={<Navigate to="/rv-inbox" replace />} />
            <Route path="/rv-inbox" element={<RvInbox />} />
            <Route path="/payment-advice" element={<PaymentAdvice />} />
            <Route path="/forward-advice" element={<ForwardAdvice />} />
            <Route path="/process-payment" element={<ProcessPayment />} />
            <Route path="/hod-approval" element={<HodApproval />} />
            <Route path="/payment-register" element={<PaymentRegister />} />
          </Routes>
        </main>
      </BrowserRouter>
    </RoleProvider>
  );
}
