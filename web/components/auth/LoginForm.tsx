"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  loginAction,
  registerAction,
  type ActionError,
} from "@/lib/auth/actions";

type Mode = "signin" | "signup";

interface LoginFormProps {
  mode: Mode;
}

const PasswordRequirement = ({
  met,
  label,
  optional,
}: {
  met: boolean;
  label: string;
  optional?: boolean;
}) => (
  <div className="flex items-center gap-2 text-xs">
    {met ? (
      <svg
        className="w-3.5 h-3.5 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ) : (
      <div
        className={cn(
          "w-3.5 h-3.5 rounded-full border",
          optional ? "border-gray-300" : "border-gray-400",
        )}
      />
    )}
    <span
      className={cn(
        met ? "text-green-700" : "text-gray-500",
        optional && !met && "text-gray-400",
      )}
    >
      {label}
      {optional && !met && " (optional)"}
    </span>
  </div>
);

function getPasswordStrength(password: string): {
  percent: number;
  label: string;
  color: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 15;

  if (score < 35)
    return {
      percent: score,
      label: "Weak",
      color: "bg-red-500",
      textColor: "text-red-600",
    };
  if (score < 55)
    return {
      percent: score,
      label: "Fair",
      color: "bg-orange-500",
      textColor: "text-orange-600",
    };
  if (score < 80)
    return {
      percent: score,
      label: "Good",
      color: "bg-yellow-500",
      textColor: "text-yellow-600",
    };
  return {
    percent: score,
    label: "Strong",
    color: "bg-green-500",
    textColor: "text-green-600",
  };
}

export function LoginForm({ mode }: LoginFormProps) {
  const isRegister = mode === "signup";
  const action = isRegister ? registerAction : loginAction;
  const [state, formAction, isPending] = useActionState<ActionError | null, FormData>(
    action,
    null,
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const error = state?.error;

  return (
    <div
      className="min-h-screen text-black relative font-primary overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
        color: "#000000",
      }}
    >
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Gradient blur overlays */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-28 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #a5b4fc, #fbcfe8, #fde68a)",
            opacity: 0.35,
            filter: "blur(64px)",
          }}
        />
        <div
          className="absolute -bottom-28 right-0 w-[28rem] h-[28rem] rounded-full blur-3xl"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #99f6e4, #6ee7b7, #a7f3d0)",
            opacity: 0.3,
            filter: "blur(64px)",
          }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-md w-full">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Image
                src="/black-transparent.png"
                alt="Cognia"
                width={40}
                height={40}
                className="w-10 h-10"
                priority
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold font-editorial text-black">
                  Cognia
                </span>
                <span className="text-xs text-gray-600 font-mono -mt-1">
                  Remember what the web showed you
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur border border-gray-200 p-8 shadow-sm">
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-light font-editorial text-gray-900 mb-2">
                  {isRegister
                    ? "Create your account"
                    : "Sign in to your account"}
                </h2>
                <p className="text-sm text-gray-600">
                  {isRegister
                    ? "Create an account, then set up or join a workspace."
                    : "Enter your credentials to continue"}
                </p>
              </div>

              <form className="space-y-5" action={formAction}>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={cn(
                      "block w-full px-4 py-3 border rounded-none transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
                      "placeholder:text-gray-400 text-gray-900 text-sm",
                      error
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-300",
                    )}
                    placeholder="name@company.com"
                    disabled={isPending}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      required
                      className={cn(
                        "block w-full px-4 py-3 pr-11 border rounded-none transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent",
                        "placeholder:text-gray-400 text-gray-900 text-sm",
                        error
                          ? "border-red-300 focus:ring-red-500"
                          : "border-gray-300",
                      )}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0A9.97 9.97 0 015.12 5.12m3.29 3.29L12 12m-3.59-3.59L3 3m9.59 9.59L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {isRegister && password.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-mono text-gray-500 uppercase tracking-wide">
                        Password Requirements
                      </div>
                      <div className="space-y-1">
                        <PasswordRequirement
                          met={password.length >= 8}
                          label="At least 8 characters"
                        />
                        <PasswordRequirement
                          met={/[A-Z]/.test(password)}
                          label="One uppercase letter"
                          optional
                        />
                        <PasswordRequirement
                          met={/[a-z]/.test(password)}
                          label="One lowercase letter"
                          optional
                        />
                        <PasswordRequirement
                          met={/[0-9]/.test(password)}
                          label="One number"
                          optional
                        />
                        <PasswordRequirement
                          met={/[!@#$%^&*(),.?":{}|<>]/.test(password)}
                          label="One special character"
                          optional
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <div className="text-xs text-gray-500">Strength:</div>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              getPasswordStrength(password).color,
                            )}
                            style={{
                              width: `${getPasswordStrength(password).percent}%`,
                            }}
                          />
                        </div>
                        <div
                          className={cn(
                            "text-xs font-medium",
                            getPasswordStrength(password).textColor,
                          )}
                        >
                          {getPasswordStrength(password).label}
                        </div>
                      </div>
                    </div>
                  )}
                  {isRegister && password.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Must be at least 8 characters
                    </p>
                  )}
                </div>

                {error && error !== "REQUIRES_2FA" && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-none">
                    <div className="flex">
                      <svg
                        className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error === "REQUIRES_2FA" && !isRegister && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-none">
                    <p className="text-sm font-medium text-blue-800">
                      Two-factor authentication required
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Enter the code from your authenticator app, then submit
                      again.
                    </p>
                    <input
                      name="totpCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      className="mt-3 block w-full px-4 py-3 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400 text-gray-900 text-sm font-mono tracking-widest text-center"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full group relative overflow-hidden rounded-none px-4 py-2 transition-all duration-200 hover:shadow-md bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="relative z-10 text-sm font-medium">
                      {isPending
                        ? isRegister
                          ? "Creating account..."
                          : "Signing in..."
                        : isRegister
                          ? "Create account"
                          : "Sign in"}
                    </span>
                    <div className="absolute inset-0 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                  </button>
                </div>
              </form>

              {/* TODO(phase-5): wire Firebase OAuth + magic link UI here.
                  Phase 2 ships email/password only — magic link is reachable
                  via the API + /auth/magic page when users have a token. */}

              <div className="relative pt-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/80 text-gray-500">
                    {isRegister
                      ? "Already have an account?"
                      : "Don't have an account?"}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <Link
                  href={isRegister ? "/login" : "/signup"}
                  className="text-sm font-medium text-black hover:text-gray-700 transition-colors duration-200"
                >
                  {isRegister ? "Sign in instead" : "Create an account"}
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200 inline-flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
