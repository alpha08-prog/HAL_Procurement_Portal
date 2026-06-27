import ApprovalQueue from '../../components/ApprovalQueue.jsx';
import { officerQueueConfig } from '../../config/officerQueue.jsx';

export default function ForwardAdvice() {
  return <ApprovalQueue config={officerQueueConfig} />;
}
