// WhatsApp click-to-chat links (wa.me). Nigerian local numbers (0803…) are converted to 234803….

export function toInternationalPhone(phone: string, defaultCountryCode = "234"): string | null {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `${defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(phone: string | null | undefined, message: string): string {
  const number = phone ? toInternationalPhone(phone) : null;
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
