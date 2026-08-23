import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import { firstScreenForRole } from './config/roles.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { RoleProvider, useRole } from './context/RoleContext.jsx';
import PortalHub from './screens/PortalHub/index.jsx';
import AiDocuments from './screens/AiDocuments/index.jsx';
import ForwardAdvice from './screens/ForwardAdvice/index.jsx';
import HodApproval from './screens/HodApproval/index.jsx';
import Login from './screens/Login/index.jsx';
import NotingHome from './screens/Noting/Home.jsx';
import Initiate from './screens/Noting/Initiate.jsx';
import Inbox from './screens/Noting/Inbox.jsx';
import SentBox from './screens/Noting/SentBox.jsx';
import UpcomingFiles from './screens/Noting/UpcomingFiles.jsx';
import Files from './screens/Noting/Files.jsx';
import Cabinet from './screens/Noting/Cabinet.jsx';
import NoteDetail from './screens/Noting/NoteDetail.jsx';
import Reports from './screens/Noting/Reports.jsx';
import Organisation from './screens/Noting/Organisation.jsx';
import AiCases from './screens/AiCases/index.jsx';
import AiCaseView from './screens/AiCases/CaseView.jsx';
import ApprovalIntake from './screens/Approvals/Intake.jsx';
import ApprovalChains from './screens/Approvals/Chains.jsx';
import ApprovalChainView from './screens/Approvals/ChainView.jsx';
import ApprovalCommittees from './screens/Approvals/Committees.jsx';
import ApprovalBids from './screens/Approvals/Bids.jsx';
import ApprovalDirectory from './screens/Approvals/Directory.jsx';
import Generate from './screens/Contracts/Generate.jsx';
import ContractRegister from './screens/Contracts/Register.jsx';
import ContractView from './screens/Contracts/ContractView.jsx';
import ClauseLibrary from './screens/Contracts/ClauseLibrary.jsx';
import PaymentAdvice from './screens/PaymentAdvice/index.jsx';
import PaymentRegister from './screens/PaymentRegister/index.jsx';
import ProcessPayment from './screens/ProcessPayment/index.jsx';
import RvInbox from './screens/RvInbox/index.jsx';
import PaymentKpis from './screens/PaymentKpis/index.jsx';

// Lands an authenticated user on the first screen their role can see.
function HomeRedirect() {
  return <Navigate to="/portal" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route path="/portal" element={<PortalHub />} />
              <Route path="/rv-inbox" element={<RvInbox />} />
              <Route path="/payment-advice" element={<PaymentAdvice />} />
              <Route path="/forward-advice" element={<ForwardAdvice />} />
              <Route path="/process-payment" element={<ProcessPayment />} />
              <Route path="/hod-approval" element={<HodApproval />} />
              <Route path="/payment-register" element={<PaymentRegister />} />
              <Route path="/payment-kpis" element={<PaymentKpis />} />
              <Route path="/ai-documents" element={<AiDocuments />} />
              <Route path="/noting/ai-documents" element={<AiDocuments />} />
              <Route path="/noting" element={<NotingHome />} />
              <Route path="/noting/initiate" element={<Initiate />} />
              <Route path="/noting/inbox" element={<Inbox />} />
              <Route path="/noting/sentbox" element={<SentBox />} />
              <Route path="/noting/upcoming" element={<UpcomingFiles />} />
              <Route path="/noting/files" element={<Files />} />
              <Route path="/noting/cabinet" element={<Cabinet />} />
              <Route path="/noting/reports" element={<Reports />} />
              <Route path="/noting/note/:txnId" element={<NoteDetail />} />
              <Route path="/noting/org" element={<Organisation />} />
              <Route path="/ai-cases" element={<AiCases />} />
              <Route path="/ai-cases/:id" element={<AiCaseView />} />
              <Route path="/approvals/intake" element={<ApprovalIntake />} />
              <Route path="/approvals/chains" element={<ApprovalChains />} />
              <Route path="/approvals/chain/:id" element={<ApprovalChainView />} />
              <Route path="/approvals/committees" element={<ApprovalCommittees />} />
              <Route path="/approvals/bids" element={<ApprovalBids />} />
              <Route path="/approvals/directory" element={<ApprovalDirectory />} />
              <Route path="/contracts/generate" element={<Generate />} />
              <Route path="/contracts/register" element={<ContractRegister />} />
              <Route path="/contracts/view/:id" element={<ContractView />} />
              <Route path="/contracts/library" element={<ClauseLibrary />} />
              <Route path="*" element={<HomeRedirect />} />
            </Route>
          </Routes>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
