import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import { firstScreenForRole } from './config/roles.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { RoleProvider, useRole } from './context/RoleContext.jsx';
import AiDocuments from './screens/AiDocuments/index.jsx';
import ForwardAdvice from './screens/ForwardAdvice/index.jsx';
import HodApproval from './screens/HodApproval/index.jsx';
import Login from './screens/Login/index.jsx';
import NotingHome from './screens/Noting/Home.jsx';
import Initiate from './screens/Noting/Initiate.jsx';
import Inbox from './screens/Noting/Inbox.jsx';
import Files from './screens/Noting/Files.jsx';
import Cabinet from './screens/Noting/Cabinet.jsx';
import NoteDetail from './screens/Noting/NoteDetail.jsx';
import Reports from './screens/Noting/Reports.jsx';
import Organisation from './screens/Noting/Organisation.jsx';
import PaymentAdvice from './screens/PaymentAdvice/index.jsx';
import PaymentRegister from './screens/PaymentRegister/index.jsx';
import ProcessPayment from './screens/ProcessPayment/index.jsx';
import RvInbox from './screens/RvInbox/index.jsx';

// Lands an authenticated user on the first screen their role can see.
function HomeRedirect() {
  const { role } = useRole();
  return <Navigate to={firstScreenForRole(role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route path="/rv-inbox" element={<RvInbox />} />
              <Route path="/payment-advice" element={<PaymentAdvice />} />
              <Route path="/forward-advice" element={<ForwardAdvice />} />
              <Route path="/process-payment" element={<ProcessPayment />} />
              <Route path="/hod-approval" element={<HodApproval />} />
              <Route path="/payment-register" element={<PaymentRegister />} />
              <Route path="/ai-documents" element={<AiDocuments />} />
              <Route path="/noting" element={<NotingHome />} />
              <Route path="/noting/initiate" element={<Initiate />} />
              <Route path="/noting/inbox" element={<Inbox />} />
              <Route path="/noting/files" element={<Files />} />
              <Route path="/noting/cabinet" element={<Cabinet />} />
              <Route path="/noting/reports" element={<Reports />} />
              <Route path="/noting/note/:txnId" element={<NoteDetail />} />
              <Route path="/noting/org" element={<Organisation />} />
              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Routes>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
