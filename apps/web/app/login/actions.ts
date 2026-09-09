"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginDemoAction(role: "buyer" | "approver") {
  const token = role === "buyer" ? "demo-buyer" : "demo-approver";
  await setSessionCookie(token);
  redirect("/account");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function submitLoginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid corporate email address." };
  }

  // Check demo shortcuts
  if (email.includes("buyer") || email.includes("procurement")) {
    await setSessionCookie("demo-buyer");
    redirect("/account");
  } else if (email.includes("approver") || email.includes("finance")) {
    await setSessionCookie("demo-approver");
    redirect("/account");
  } else {
    // Default demo login for any corporate email in preview
    await setSessionCookie("demo-buyer");
    redirect("/account");
  }
}
