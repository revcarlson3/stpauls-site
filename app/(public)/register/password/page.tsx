import PasswordForm from "./password-form";

export default function PasswordSetupPage({ searchParams }: { searchParams: { token?: string } }) {
  return <PasswordForm token={searchParams.token ?? ""} />;
}

