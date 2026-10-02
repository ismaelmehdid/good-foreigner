export default function Disclaimer() {
  return (
    <footer className="mt-10 border-t border-stone-200 pt-6 pb-10 text-sm text-stone-600 dark:border-stone-800 dark:text-stone-400">
      <p className="font-medium text-stone-800 dark:text-stone-200">
        Informational only — not legal advice. Confirm with an immigration attorney.
      </p>
      <p className="mt-2">
        This app stores nothing. Your profile stays in this browser, and the emails or text you
        check are sent to Google&apos;s Gemini API for analysis.
      </p>
    </footer>
  );
}
