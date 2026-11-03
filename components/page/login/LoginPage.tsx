import AuthForm from "@/components/auth/AuthForm";
import AuthShell from "@/components/auth/AuthShell";

export default function LoginPage({ accountCreated }: { accountCreated: boolean }) {
  return <AuthShell><AuthForm mode="login" accountCreated={accountCreated} /></AuthShell>;
}
