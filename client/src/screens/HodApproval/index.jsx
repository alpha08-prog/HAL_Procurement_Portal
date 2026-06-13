import ApprovalQueue from '../../components/ApprovalQueue.jsx';
import { hodQueueConfig } from '../../config/hodQueue.jsx';

export default function HodApproval() {
  return <ApprovalQueue config={hodQueueConfig} />;
}
