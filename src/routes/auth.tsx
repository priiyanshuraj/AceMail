import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { submitAccessRequest } from "@/lib/access-requests.functions";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import logoUrl from "@/assets/acemail-logo.png";
import { SakuraScene } from "@/components/SakuraScene";
import { PetalField } from "@/components/PetalField";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AceMail" },
      { name: "description", content: "Sign in to AceMail to manage your cold email campaigns." },
      { property: "og:title", content: "Sign in — AceMail" },
      { property: "og:description", content: "Sign in to AceMail to manage your cold email campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next: rawNext } = Route.useSearch();
  const next = rawNext ? oauthReturnPath(rawNext) : null;
  const nextHref = () => (next ? new URL(next, window.location.origin).href : window.location.origin);
  const goNext = () => (next ? window.location.assign(next) : navigate({ to: "/dashboard" }));
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessReferral, setAccessReferral] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessLoading(true);
    try {
      await submitAccessRequest({ data: { email: accessEmail, referral: accessReferral.trim() || null } });
      setAccessRequested(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your request");
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("acemail-theme", next ? "dark" : "light");
    } catch {}
  };


  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a password reset link.");
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: nextHref() },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goNext();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: nextHref(),
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    goNext();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <SakuraScene />
      <PetalField />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-20"
        onClick={toggleTheme}
        aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
        title={dark ? "Day mode" : "Night mode"}
      >
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
      <Card className="glass-strong relative z-10 w-full max-w-md border-border/60">

        <CardHeader className="text-center">
          <img src={logoUrl} alt="AceMail logo" className="mx-auto mb-2 h-14 w-14 rounded-xl" width={56} height={56} />
          <CardTitle className="text-2xl">AceMail</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Sign in to your account"
              : mode === "signup"
                ? "Create your account"
                : "We'll email you a link to reset your password"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode !== "forgot" && (
            <>
              <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
                Continue with Google
              </Button>
              {previewOk && (
                <Button
                  variant="secondary"
                  className="w-full"
                  type="button"
                  onClick={() => {
                    setDevPreview(true);
                    navigate({ to: "/dashboard" });
                  }}
                >
                  Open in preview mode (no sign-in)
                </Button>
              )}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordInput
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          <div className="border-t border-border/60 pt-4">
            {accessRequested ? (
              <p className="rounded-md border border-border/60 p-3 text-center text-sm">
                You're on the list. We'll email your invite soon.
              </p>
            ) : showAccess ? (
              <form onSubmit={handleRequestAccess} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="access-email">Your email</Label>
                  <Input
                    id="access-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@company.com"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="access-referral">Referred by? (optional)</Label>
                  <Input
                    id="access-referral"
                    placeholder="Name or code"
                    value={accessReferral}
                    onChange={(e) => setAccessReferral(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAccess(false)}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={accessLoading}>
                    {accessLoading ? "Sending..." : "Request access"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <Button variant="outline" className="w-full" type="button" onClick={() => setShowAccess(true)}>
                  Request access with your email
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Not on the list yet? Leave your email and we'll send your invite.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
