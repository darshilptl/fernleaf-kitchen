import { LoginForm } from "@/components/sections/login-form"

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center gap-6 bg-background p-6 md:p-20">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
