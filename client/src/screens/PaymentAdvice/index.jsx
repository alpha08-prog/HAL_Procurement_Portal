import { useSearchParams } from 'react-router-dom';
import PaForm from './PaForm.jsx';
import PaPicker from './PaPicker.jsx';

// Screen 2 — Payment Advice (maker verification). Opened with ?pa=<paNo> it shows
// the verification form; opened bare (from nav) it lists drafts to pick from.
export default function PaymentAdvice() {
  const [searchParams] = useSearchParams();
  const paNo = searchParams.get('pa');
  return paNo ? <PaForm paNo={paNo} /> : <PaPicker />;
}
