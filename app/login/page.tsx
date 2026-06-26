import { LoginForm } from './login-form'

const ERROR_MESSAGES: Record<string, string> = {
  desabilitado: 'Usuário sem permissão de acesso. Fale com o administrador.',
}

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const initialError = params.error ? (ERROR_MESSAGES[params.error] ?? undefined) : undefined

  return <LoginForm initialError={initialError} />
}
