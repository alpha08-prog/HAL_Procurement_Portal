import ApprovalQueue from '../../components/ApprovalQueue.jsx';
import { deskQueueConfig } from '../../config/deskQueue.jsx';

export default function ProcessPayment() {
  return <ApprovalQueue config={deskQueueConfig} />;
}
