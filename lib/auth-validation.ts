export const AUTH_MESSAGES = {
  registrationRequired: "Preencha todos os campos obrigatórios para continuar",
  loginRequired: "Preencha e-mail e senha para continuar",
  passwordTooShort: "A senha deve possuir no mínimo 8 caracteres",
  emailTaken: "Já existe uma conta cadastrada com este e-mail",
  accountNotFound: "Nenhuma conta foi encontrada com o e-mail informado",
  wrongPassword: "Senha incorreta. Tente novamente",
  registrationFailed:
    "Não foi possível concluir o cadastro neste momento. Tente novamente mais tarde",
  loginFailed:
    "Não foi possível acessar sua conta neste momento. Tente novamente mais tarde",
  registrationSuccess: "Conta criada com sucesso",
  loginSuccess: "Login realizado com sucesso",
} as const;

export type LoginInput = { email: string; senha: string };
export type RegistrationInput = LoginInput & { nome: string };
export type AuthField = keyof RegistrationInput;
export type FieldErrors = Partial<Record<AuthField, string>>;

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors: FieldErrors };

function readFields(value: unknown) {
  const body =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    nome: typeof body.nome === "string" ? body.nome.trim() : "",
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    senha: typeof body.senha === "string" ? body.senha : "",
  };
}

function validateEmailAndPassword(email: string, senha: string): FieldErrors {
  const errors: FieldErrors = {};

  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    errors.email = "Informe um e-mail válido";
  }
  if (senha.length > 1024) {
    errors.senha = "A senha deve possuir no máximo 1024 caracteres";
  }

  return errors;
}

export function validateLogin(value: unknown): ValidationResult<LoginInput> {
  const { email, senha } = readFields(value);

  if (!email || !senha.trim()) {
    return {
      success: false,
      message: AUTH_MESSAGES.loginRequired,
      fieldErrors: {
        ...(!email && { email: "Informe seu e-mail" }),
        ...(!senha.trim() && { senha: "Informe sua senha" }),
      },
    };
  }

  const fieldErrors = validateEmailAndPassword(email, senha);
  const message = Object.values(fieldErrors)[0];
  if (message) return { success: false, message, fieldErrors };

  return { success: true, data: { email, senha } };
}

export function validateRegistration(
  value: unknown,
): ValidationResult<RegistrationInput> {
  const { nome, email, senha } = readFields(value);

  if (!nome || !email || !senha.trim()) {
    return {
      success: false,
      message: AUTH_MESSAGES.registrationRequired,
      fieldErrors: {
        ...(!nome && { nome: "Informe seu nome" }),
        ...(!email && { email: "Informe seu e-mail" }),
        ...(!senha.trim() && { senha: "Informe sua senha" }),
      },
    };
  }

  const fieldErrors = validateEmailAndPassword(email, senha);
  if (nome.length > 120) {
    fieldErrors.nome = "O nome deve possuir no máximo 120 caracteres";
  }
  if (senha.length < 8) fieldErrors.senha = AUTH_MESSAGES.passwordTooShort;

  const message = Object.values(fieldErrors)[0];
  if (message) return { success: false, message, fieldErrors };

  return { success: true, data: { nome, email, senha } };
}
