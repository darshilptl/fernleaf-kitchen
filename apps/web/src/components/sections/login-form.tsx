"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { cn } from "cn"
import Image from "next/image"
import { loginSchema, type LoginInput } from "@repo/shared"
import { Button } from "@repo/ui/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field"
import { Input } from "@repo/ui/components/ui/input"
import { SESSION_QUERY_KEY } from "@/hooks/use-session"
import { ApiError, apiRequest } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/apply-server-errors"
import { broadcastSessionChanged } from "@/lib/session-broadcast"
import type { Session } from "@/lib/session"

interface LoginFormProps extends React.ComponentProps<"div"> {}

/**
 * Email + password only. Schema comes from packages/shared so the
 * client parses the same shape the server validates. On success
 * the session cache fills from the login response and the user
 * lands on their role landingPath (or ?next= when safe).
 */
export function LoginForm({
  className,
  ...props
}: LoginFormProps): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest<Session>("/api/auth/login", { method: "POST", body: input }),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session)
      broadcastSessionChanged()
      const next = searchParams.get("next")
      const target =
        next !== null && next.startsWith("/") && !next.startsWith("//")
          ? next
          : session.landingPath
      router.push(target)
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        applyServerErrors(form, error)
      } else {
        form.setError("root.server", {
          type: "server",
          message: "Request failed",
        })
      }
    },
  })

  const emailError = form.formState.errors.email?.message
  const passwordError = form.formState.errors.password?.message
  const serverError = form.formState.errors.root?.server?.message

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit((input) => login.mutateAsync(input))()
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <Image
              src="/icons/icon.png"
              alt="icon"
              className="h-auto w-auto"
              width={40}
              height={40}
            />
            <p className="text-balance text-muted-foreground">
              Login to your Fernleaf Kitchen account
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="role@account.com"
              autoComplete="email"
              aria-invalid={emailError !== undefined}
              aria-describedby={
                emailError !== undefined ? "email-error" : undefined
              }
              {...form.register("email")}
            />
            {emailError !== undefined && (
              <p id="email-error" className="text-destructive">
                {emailError}
              </p>
            )}
          </Field>
          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={passwordError !== undefined}
              aria-describedby={
                passwordError !== undefined ? "password-error" : undefined
              }
              {...form.register("password")}
            />
            {passwordError !== undefined && (
              <p id="password-error" className="text-destructive">
                {passwordError}
              </p>
            )}
          </Field>
          {serverError !== undefined && (
            <p role="alert" className="text-destructive">
              {serverError}
            </p>
          )}
          <Field>
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? "Logging in…" : "Login"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
