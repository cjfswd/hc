"use client"

import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

const signInErrorMessages = {
  Signin: "Falha ao iniciar a sessão. Tente novamente mais tarde.",
  OAuthSignin: "Falha ao iniciar sessão com o provedor. Verifique as permissões.",
  OAuthCallbackError: "Erro ao retornar do provedor de login. Tente novamente.",
  OAuthCreateAccount: "Erro ao criar sua conta via provedor. Use outro método.",
  EmailCreateAccount: "Erro ao criar conta com e-mail. Verifique os dados e tente novamente.",
  Callback: "Erro inesperado durante o login. Tente novamente.",
  OAuthAccountNotLinked:
    "Esta conta já está vinculada a outro método de login. Use o mesmo para entrar.",
  EmailSignin: "Erro ao enviar e-mail de login. Verifique o endereço e tente novamente.",
  CredentialsSignin: "Credenciais inválidas. Verifique e tente novamente.",
  SessionRequired: "Você precisa estar logado para acessar esta página.",
} as const

export function SignInErrorAlert() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") as typeof signInErrorMessages | null
  const message = error ? signInErrorMessages[error as unknown as keyof typeof signInErrorMessages] : null

  if (!message) return null

  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircleIcon className="h-5 w-5" />
      <AlertTitle>Erro ao fazer login</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
