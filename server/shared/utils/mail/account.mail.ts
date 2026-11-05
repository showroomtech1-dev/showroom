// Account emails: welcome, password reset code, password changed, password reset by an admin.
import { ctaButton, emailLayout, esc, footnote, heading, infoBox, otpBox, paragraph, warningBox, type LayoutBrand } from "../mailer";

export interface ComposedMail {
  subject: string;
  html: string;
  text: string;
}

export function welcomeEmail(p: { brand: LayoutBrand; name: string; email: string; roleName: string; tempPassword: string; mustChange: boolean; loginUrl: string }): ComposedMail {
  const body = [
    heading(`Welcome to ${p.brand.businessName}`),
    paragraph(`Hi ${esc(p.name)}, an account has been created for you on ShowroomPro as <strong>${esc(p.roleName)}</strong>.`),
    infoBox("Your sign-in details", `Email: <strong>${esc(p.email)}</strong><br>Password: <strong>${esc(p.tempPassword)}</strong>`),
    p.mustChange ? paragraph("You'll be asked to choose your own password the first time you sign in.") : "",
    ctaButton(p.loginUrl, "Sign in"),
    footnote("If you weren't expecting this, you can ignore this email or tell the business owner."),
  ].join("");
  return {
    subject: `Your ShowroomPro account — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Hi ${p.name}, an account was created for you at ${p.brand.businessName} (${p.roleName}). Sign in at ${p.loginUrl} with ${p.email} and password ${p.tempPassword}.`,
  };
}

export function passwordResetCodeEmail(p: { brand: LayoutBrand; name: string; code: string; minutes: number }): ComposedMail {
  const body = [
    heading("Reset your password"),
    paragraph(`Hi ${esc(p.name)}, use this code to set a new password. It expires in ${p.minutes} minutes.`),
    otpBox(p.code),
    footnote("If you didn't ask to reset your password, ignore this email — your password stays the same."),
  ].join("");
  return {
    subject: `Reset your password — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `Your ShowroomPro password reset code is ${p.code}. It expires in ${p.minutes} minutes. If you didn't ask for this, ignore this email.`,
  };
}

export function passwordChangedEmail(p: { brand: LayoutBrand; name: string; when: string }): ComposedMail {
  const body = [
    heading("Your password was changed"),
    paragraph(`Hi ${esc(p.name)}, the password for your ShowroomPro account was changed on ${esc(p.when)}. You've been signed out of other devices.`),
    warningBox("If this wasn't you, contact the business owner straight away so they can secure your account."),
  ].join("");
  return {
    subject: `Your password was changed — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `The password for your ShowroomPro account was changed on ${p.when}. If this wasn't you, contact the business owner straight away.`,
  };
}

export function passwordResetByAdminEmail(p: { brand: LayoutBrand; name: string; tempPassword: string; loginUrl: string }): ComposedMail {
  const body = [
    heading("Your password was reset"),
    paragraph(`Hi ${esc(p.name)}, a manager has reset your ShowroomPro password.`),
    infoBox("Temporary password", `<strong>${esc(p.tempPassword)}</strong>`),
    paragraph("Sign in and choose a new password."),
    ctaButton(p.loginUrl, "Sign in"),
  ].join("");
  return {
    subject: `Your password was reset — ${p.brand.businessName}`,
    html: emailLayout(body, p.brand),
    text: `A manager reset your ShowroomPro password. Temporary password: ${p.tempPassword}. Sign in at ${p.loginUrl} and choose a new one.`,
  };
}
