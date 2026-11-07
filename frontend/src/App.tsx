import FinanceWorkspace from './FinanceWorkspace';
import { AuthGate } from './features/auth/AuthGate';

export default function App() {
  return <AuthGate><FinanceWorkspace/></AuthGate>;
}
