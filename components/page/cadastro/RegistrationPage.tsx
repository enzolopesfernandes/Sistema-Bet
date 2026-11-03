import AuthForm from "@/components/auth/AuthForm";
import AuthShell from "@/components/auth/AuthShell";

export default function RegistrationPage() {
  return <AuthShell><AuthForm mode="cadastro" /></AuthShell>;
}
