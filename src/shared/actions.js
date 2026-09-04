const REMEMBER_REQUEST = /(?:覚え(?:て|といて|ておいて)|記憶して|忘れないで|remember(?:\s+(?:this|that))?|keep\s+(?:this|that)\s+in\s+mind)/iu;
const SENSITIVE_MEMORY = /(?:password|passcode|api[\s-]?key|secret key|credit card|card number|bank account|phone number|email address|home address|precise location|medical diagnosis|medication|パスワード|暗証番号|APIキー|秘密鍵|クレジットカード|カード番号|銀行口座|電話番号|メールアドレス|自宅住所|現在地|病名|診断|服薬)/iu;

/**
 * Extract a stable detail from a direct request to remember it.
 * @param {string} source
 * @returns {string}
 */
export function rememberedValue(source) {
  if (typeof source !== "string" || !REMEMBER_REQUEST.test(source) || SENSITIVE_MEMORY.test(source)) return "";
  const value = source
    .trim()
    .replace(/^(?:これ(?:を|だけ)?|このことを)?\s*(?:覚え(?:て|といて|ておいて)|記憶して|忘れないで)[：:、,\s]*/u, "")
    .replace(/^(?:please\s+)?(?:remember(?:\s+(?:this|that))?|keep\s+(?:this|that)\s+in\s+mind)[,:;\s]*/i, "")
    .replace(/[\s、,]*(?:って|と)?(?:覚え(?:て|といて|ておいて)(?:ね|ほしい)?|記憶して(?:ね)?|忘れないで)[。.!！\s]*$/u, "")
    .replace(/[\s,]*(?:please\s+)?(?:remember(?:\s+(?:this|that))?|keep\s+(?:this|that)\s+in\s+mind)[.!?\s]*$/i, "")
    .trim();
  return value.length >= 2 ? value.slice(0, 280) : "";
}

/**
 * Add a visible approval action when the model omits one after a direct remember request.
 * @param {Array<{ type: string, label: string, value: string }>} actions
 * @param {string} latestUserText
 * @param {string} label
 */
export function ensureRememberAction(actions, latestUserText, label) {
  const current = Array.isArray(actions) ? actions : [];
  if (current.some((action) => action.type === "remember")) return current;
  const value = rememberedValue(latestUserText);
  if (!value) return current;
  return [...current.slice(0, 2), { type: "remember", label, value }];
}
